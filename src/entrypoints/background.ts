import { Effect, Option } from "effect"
import { defineBackground } from "wxt/utils/define-background"
import { chosenView } from "@/app/settings"
import { welcomeFor } from "@/app/welcoming"
import { goingTo, payloadsOnTheWay } from "@/github/onTheWay"
import { answering, askedAbout } from "@/github/throughTheWorker"
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
import { browserSettings } from "@/settings/browserStore"
import {
  isLedgerAcross,
  isLedgerAsk,
  isLedgerNames,
  isLedgerWarm,
  LEDGER_ACROSS_WORK,
  LEDGER_NAMES_WORK,
  LEDGER_WARM_WORK,
  LEDGER_WORK,
  type LedgerWork
} from "@/ledger/protocol"
import {
  isWasmProbe,
  WASM_PROBE_WORK,
  type WasmProbeWork
} from "@/wasm-probe/protocol"

/**
 * The one document this extension works in away from the page, and the one
 * function that opens it.
 *
 * One, because Chrome allows one: a second `createDocument` is refused with
 * "Only a single offscreen document may be created", measured in plan 009. It
 * used to be Mermaid's alone and named after it. Three jobs live there now —
 * diagrams, the Ledger's parsing, and plan 009's probe — so it is named after
 * the place rather than after whichever of them asked first, and every reason
 * any of them needs is given when it opens. See `src/entrypoints/offscreen/`.
 */
const OFFSCREEN_PATH = "offscreen.html"

let creatingOffscreen: PromiseLike<void> | null = null

const ensureOffscreen: Effect.Effect<boolean, unknown> = Effect.gen(function* () {
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
    // Both, because the document does both: Mermaid measures text in a real
    // document, and the Ledger parses in a worker at our own origin.
    reasons: ["DOM_PARSER", "WORKERS"],
    justification: "Lay out diagrams and parse code away from the page it is read on."
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
    if (!(yield* ensureOffscreen)) return unavailable()

    const answer: unknown = yield* Effect.promise(() =>
      browser.runtime.sendMessage({
        kind: MERMAID_WORK,
        code
      } satisfies MermaidWork)
    )
    return isMermaidAnswer(answer) ? answer : unavailable()
  }).pipe(Effect.orElseSucceed(unavailable))

/**
 * A question about a file, put to the document that can parse one.
 *
 * The relay is a hop and not a decision: what a Name means is
 * `src/ledger/writings.ts`'s to say, and where it may be worked out is the
 * offscreen document's. This is the wire between them, and the only thing it
 * knows is that the two ends use different words for the same question — see
 * `src/ledger/protocol.ts` for why they have to.
 *
 * A failure here is answered rather than raised. The screen asking has a way of
 * drawing nothing, and that is what it does for a language nothing parses, a
 * document that would not open and a browser without the API alike.
 */
/**
 * One question, to the document that can answer it, with a way to say it could
 * not be asked.
 *
 * Every Ledger message is the same three steps — open the document, send the
 * question under the word the document listens for, answer with something the
 * screen can read either way. Written once rather than three times, because the
 * third of them was where the first two's differences would have shown up.
 */
const relay = <A>(work: { readonly kind: string }, instead: A): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    if (!(yield* ensureOffscreen)) return instead

    return yield* Effect.promise(() => browser.runtime.sendMessage(work))
  }).pipe(Effect.catch(() => Effect.succeed(instead)))

const askTheLedger = (ask: { readonly path: string; readonly text: string; readonly key?: string; readonly question: unknown }): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    if (!(yield* ensureOffscreen)) return { kind: "gitquiet/ledger-answer", why: "no offscreen API" }

    return yield* Effect.promise(() =>
      browser.runtime.sendMessage({
        kind: LEDGER_WORK,
        path: ask.path,
        text: ask.text,
        ...(ask.key === undefined ? {} : { key: ask.key }),
        question: ask.question
      } as LedgerWork)
    )
  }).pipe(
    Effect.catch((cause) =>
      Effect.succeed({ kind: "gitquiet/ledger-answer", why: String(cause) })
    )
  )

/*
 * Plan 009's probe, and the only thing in this file that is not the product.
 *
 * It asks one question — can WebAssembly be compiled at our own origin, on a
 * page github.com serves — and `scripts/probe-wasm.ts` is the only caller. It
 * shares the document above rather than opening one of its own, which is the
 * finding it came back with.
 */

const askTheProbe: Effect.Effect<unknown> = Effect.gen(function* () {
  if (!(yield* ensureOffscreen)) {
    return { kind: "gitquiet/wasm-probe-answer", attempts: [], notes: ["no offscreen API"] }
  }

  return yield* Effect.promise(() =>
    browser.runtime.sendMessage({ kind: WASM_PROBE_WORK } satisfies WasmProbeWork)
  )
}).pipe(
  Effect.catch((cause) =>
    Effect.succeed({
      kind: "gitquiet/wasm-probe-answer",
      attempts: [],
      notes: [`the offscreen document never opened: ${String(cause)}`]
    })
  )
)

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

  browser.runtime.onMessage.addListener((message: unknown) => {
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
    if (isLedgerAsk(message)) {
      return Effect.runPromise(askTheLedger(message))
    }
    if (isLedgerWarm(message)) {
      return Effect.runPromise(
        relay({ ...message, kind: LEDGER_WARM_WORK }, { ready: false, why: "no offscreen API" })
      )
    }
    if (isLedgerNames(message)) {
      return Effect.runPromise(
        relay({ ...message, kind: LEDGER_NAMES_WORK }, { places: [], ready: false })
      )
    }
    if (isLedgerAcross(message)) {
      return Effect.runPromise(
        relay({ ...message, kind: LEDGER_ACROSS_WORK }, { uses: [], ready: false })
      )
    }
    if (isWasmProbe(message)) {
      return Effect.runPromise(askTheProbe)
    }
    return undefined
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
