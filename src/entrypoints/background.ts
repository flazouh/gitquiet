import { Effect, Option } from "effect"
import { defineBackground } from "wxt/utils/define-background"
import { chosenView } from "@/app/settings"
import { welcomeFor } from "@/app/welcoming"
import { goingTo, payloadsOnTheWay } from "@/github/onTheWay"
import { answering, askedAbout } from "@/github/throughTheWorker"
import {
  isMermaidAnswer,
  isMermaidRequest,
  MERMAID_UNAVAILABLE,
  MERMAID_WORK,
  type MermaidUnavailable,
  type MermaidWork
} from "@/markdown/mermaidProtocol"
import { initialiseErrorReporting } from "@/observability/sentry"
import { browserSettings } from "@/settings/browserStore"

const OFFSCREEN_PATH = "mermaid-offscreen.html"

let creatingOffscreen: PromiseLike<void> | null = null

const ensureMermaidDocument: Effect.Effect<boolean, unknown> = Effect.gen(function* () {
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
    reasons: ["DOM_PARSER"],
    justification: "Lay out Mermaid diagrams without blocking GitHub navigation."
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
    if (!(yield* ensureMermaidDocument)) return unavailable()

    const answer: unknown = yield* Effect.promise(() =>
      browser.runtime.sendMessage({
        kind: MERMAID_WORK,
        code
      } satisfies MermaidWork)
    )
    return isMermaidAnswer(answer) ? answer : unavailable()
  }).pipe(Effect.orElseSucceed(unavailable))

/**
 * The worker, which reads a pull request before there is a page to read it on.
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
 * What it does do is the one job nothing on a page can. A script of ours cannot run
 * until GitHub's HTML answers, which is 1.2 to 3.6 seconds on a large pull request;
 * this is told the address when the tab starts moving. The wake cost above is paid
 * by the navigation rather than by the reader, and it is paid in parallel with a
 * document that has seconds to go. See `onTheWay.ts`.
 */
export default defineBackground(() => {
  initialiseErrorReporting("service-worker")

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isMermaidRequest(message)) return undefined
    return Effect.runPromise(drawMermaidAwayFromThePage(message.code))
  })

  /*
   * The read, started the moment a tab begins going to a pull request.
   *
   * `onBeforeNavigate` rather than a later event because earlier is the whole point,
   * and the top frame only: an iframe on some other page that happens to hold a pull
   * request is not a page anybody is about to read.
   *
   * It fires for navigations that never arrive as well — one cancelled, one refused,
   * one the browser was guessing at — and each of those costs seven requests to
   * GitHub for a page nobody opened. Left as it is, deliberately: the reader was
   * headed there, the requests are the ones their own page would have made, and the
   * alternative is to wait for an event that arrives after the point of this.
   *
   * Nothing is done with the failure. A reader whose network is down or whose
   * organisation wants a single sign-on finds that out on the page, from a card that
   * can say so; here it would be a message to nobody.
   */
  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return

    const wanted = goingTo(details.url)
    if (Option.isNone(wanted)) return

    Effect.runFork(
      chosenView(browserSettings()).pipe(
        Effect.flatMap((view) =>
          view === "github" ? Effect.void : payloadsOnTheWay(wanted.value)
        ),
        Effect.catch(() => Effect.void),
        Effect.catchCause(() => Effect.void)
      )
    )
  })

  /*
   * And the page, arriving a second or two later, asking for what that found.
   *
   * `true` is returned to keep the channel open while the read finishes, which is
   * what `onMessage` requires of an answer that is not immediate. Every other message
   * is somebody else's, so it is left alone with an undefined return.
   */
  browser.runtime.onMessage.addListener((message, _sender, respond) => {
    const wanted = askedAbout(message)
    if (Option.isNone(wanted)) return undefined

    answering(wanted.value, payloadsOnTheWay, respond)
    return true
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
