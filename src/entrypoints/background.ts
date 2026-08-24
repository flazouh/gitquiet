import { Effect } from "effect"
import { defineBackground } from "wxt/utils/define-background"
import { welcomeFor } from "@/app/welcoming"
import { highlight } from "@/markdown/highlighter"
import {
  HIGHLIGHT_ANSWER,
  isHighlightRequest,
  type HighlightAnswer
} from "@/markdown/highlighterProtocol"
import {
  isMermaidAnswer,
  isMermaidRequest,
  MERMAID_UNAVAILABLE,
  MERMAID_WORK,
  type MermaidUnavailable,
  type MermaidWork
} from "@/markdown/mermaidProtocol"
import { initialiseErrorReporting } from "@/observability/sentry"
import {
  DIFF_WORKER_ANSWER,
  DIFF_WORKER_WORK,
  isDiffWorkerAnswer,
  isDiffWorkerRequest,
  type DiffWorkerAnswer,
  type DiffWorkerWork,
  workerError
} from "@/diff/workerProtocol"

const OFFSCREEN_PATH = "mermaid-offscreen.html"

let creatingOffscreen: PromiseLike<void> | null = null

const ensureOffscreenDocument: Effect.Effect<boolean, unknown> = Effect.gen(function* () {
  if (!("offscreen" in browser) || browser.offscreen?.createDocument === undefined) return false

  const url = (browser.runtime.getURL as (path: string) => string)(OFFSCREEN_PATH)
  const contexts = yield* Effect.tryPromise({
    try: () =>
      browser.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [url]
      }),
    catch: (cause) => cause
  })
  if (contexts.length > 0) return true

  creatingOffscreen ??= browser.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["DOM_PARSER", "WORKERS"],
    justification: "Lay out diagrams and highlight diffs without blocking GitHub navigation."
  })
  const opening = creatingOffscreen

  yield* Effect.tryPromise({
    try: () => opening,
    catch: (cause) => cause
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        creatingOffscreen = null
      })
    )
  )

  return true
})

const unavailable = (): MermaidUnavailable => ({ kind: MERMAID_UNAVAILABLE })

const drawMermaidAwayFromThePage = (code: string): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    if (!(yield* ensureOffscreenDocument)) return unavailable()

    const answer: unknown = yield* Effect.promise(() =>
      browser.runtime.sendMessage({
        kind: MERMAID_WORK,
        code
      } satisfies MermaidWork)
    )
    return isMermaidAnswer(answer) ? answer : unavailable()
  }).pipe(Effect.orElseSucceed(unavailable))

const runDiffWorker = (request: { readonly id: string }): Effect.Effect<DiffWorkerAnswer> =>
  ensureOffscreenDocument.pipe(
    Effect.flatMap((ready) =>
      ready
        ? Effect.tryPromise({
            try: () =>
              browser.runtime.sendMessage({
                kind: DIFF_WORKER_WORK,
                request
              } satisfies DiffWorkerWork),
            catch: (cause) => cause
          })
        : Effect.fail("offscreen-unavailable" as const)
    ),
    Effect.map((answer) =>
      isDiffWorkerAnswer(answer)
        ? answer
        : ({
            kind: DIFF_WORKER_ANSWER,
            response: workerError(request.id, "Diff worker returned no answer")
          } satisfies DiffWorkerAnswer)
    ),
    Effect.catch((cause) =>
      Effect.succeed({
        kind: DIFF_WORKER_ANSWER,
        response: workerError(request.id, cause)
      } satisfies DiffWorkerAnswer)
    )
  )

/**
 * The worker, which has nothing left to do but be reachable.
 *
 * It used to inject an interface on request: a content script is matched against
 * the address a document was *loaded* with, GitHub loads no documents, and
 * injecting is a privilege a page does not have — so every soft navigation to one
 * of these pages went through a message to here. The cost was the worker itself.
 * MV3 stops an idle one after about thirty seconds, and waking it took long enough
 * for GitHub's own list to be on the screen: 587 milliseconds, measured on a live
 * page, coming and going depending on whether the reader's last press had happened
 * to warm it.
 *
 * The shell imports the screen instead — an extension file the manifest publishes,
 * fetched from disk with nobody to wake. See `src/app/screens.ts`.
 *
 * Kept because a worker is where errors from anywhere in the extension are
 * reported from, and because an extension without one has no way to be told it has
 * been updated.
 */
export default defineBackground(() => {
  initialiseErrorReporting("service-worker")

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isDiffWorkerRequest(message)) {
      return Effect.runPromise(runDiffWorker(message.request))
    }
    if (isHighlightRequest(message)) {
      return Effect.runPromise(
        highlight(message.code, message.language, message.theme).pipe(
          Effect.map(
            (html) => ({ kind: HIGHLIGHT_ANSWER, html }) satisfies HighlightAnswer
          )
        )
      )
    }
    if (isMermaidRequest(message)) {
      return Effect.runPromise(drawMermaidAwayFromThePage(message.code))
    }
    return undefined
  })

  /*
   * The onboarding, once, on the install.
   *
   * Which reasons deserve a tab is `welcoming.ts`'s to say and is tested there: this
   * listener fires on an update as well, and a tab that opens by itself because
   * something updated in the background is the behaviour that gets an extension
   * uninstalled.
   */
  browser.runtime.onInstalled.addListener((details) => {
    const at = welcomeFor(details.reason, { development: import.meta.env.DEV })
    if (at === null) return

    void browser.tabs.create({ url: at })
  })
})
