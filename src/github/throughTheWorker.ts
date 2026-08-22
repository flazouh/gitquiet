import { Cause, Effect, Option, Schema } from "effect"
import { PullRequestRef } from "../domain/PullRequestRef"
import { GatewayError, type GatewayFailure } from "../ports/GitHubGateway"
import { claimArrival } from "./arrival"
import { CHANGES, payloadsFor } from "./asking"
import type { RawPayloads } from "./snapshot"

/**
 * The one question the page asks the service worker, and the worker's answer.
 *
 * Both halves are here so that they cannot drift apart. What travels is JSON and
 * nothing else: a message is structured-cloned between two realms, and a decoded
 * pull request full of `Option`s made by one bundle's Effect would not survive the
 * trip — the same rule `flight.ts` follows for the same reason.
 *
 * Why the page asks at all, rather than reading GitHub itself: the worker has
 * already started. It is told the address when the tab begins moving, seconds
 * before their HTML answers and before any script of ours exists on the page. By
 * asking rather than reading, the page joins that read instead of starting a
 * second one, and two tabs on the same pull request are one read as well.
 */

const ASKING = "gitquiet:pull-request-payloads"

export type Asked = {
  readonly what: typeof ASKING
  readonly reference: PullRequestRef
}

export type Answered =
  | { readonly ok: true; readonly payloads: RawPayloads }
  | {
      readonly ok: false
      readonly route: string
      readonly reason: GatewayFailure
      readonly detail: string
    }

export const askingFor = (reference: PullRequestRef): Asked => ({ what: ASKING, reference })

const asReference = Schema.decodeUnknownOption(PullRequestRef)

/**
 * The pull request a message off the wire is asking about, and nothing for a
 * message that is not asking this question at all.
 *
 * The reference is decoded rather than trusted. A worker hears every message any
 * part of the extension sends, one without a reference passed a check of the name
 * alone, and what followed was worse than a wrong answer: the read died on a
 * reference that was not there, the reply never came, and the page went on waiting
 * on a channel the worker had already promised to answer.
 */
export const askedAbout = (message: unknown): Option.Option<PullRequestRef> => {
  if (typeof message !== "object" || message === null) return Option.none()
  if ((message as { what?: unknown }).what !== ASKING) return Option.none()

  return asReference((message as { reference?: unknown }).reference)
}

/**
 * The worker's answer, put back into the failure the page would have raised itself.
 *
 * A rejected `sendMessage` and an answer in a shape this does not recognise are both
 * treated as no worker at all, which is what {@link payloadsThroughWorker} falls back
 * on. Anything else would trade a pull request for a plumbing failure.
 */
const asAnswered = (value: unknown): Answered | undefined => {
  if (typeof value !== "object" || value === null) return undefined

  return typeof (value as { ok?: unknown }).ok === "boolean" ? (value as Answered) : undefined
}

const sending = (reference: PullRequestRef): Effect.Effect<Answered | undefined> =>
  Effect.tryPromise(() => browser.runtime.sendMessage(askingFor(reference))).pipe(
    Effect.map(asAnswered),
    Effect.catch(() => Effect.succeed(undefined))
  )

/**
 * Whether this read is the arrival the worker was told about, which is the only read
 * it has an answer to.
 *
 * The question is about the document rather than the moment, and it used to be asked of
 * `readyState`: a document still loading was an arrival, a complete one was a press or a
 * Back. That test names the right pages and asks them too late. The screen that does the
 * asking is a bundle of its own, and on a heavy pull request it finished loading 1.5
 * seconds behind the shell — past GitHub's own `load` event. So every arrival looked
 * settled, skipped the worker, and read GitHub a second time while the worker sat on the
 * answer. Measured at 1.2 seconds of the reader's time, spent on a read already done.
 *
 * The note is taken instead at `document_start`, where the answer is plain. See
 * `arrival.ts` for what it is worth and what taking it costs.
 *
 * Still asked of the pull request and not only of the document, because a read of one is
 * not always about the page it is on: resting on a row of a list reads that pull request
 * ahead, and the worker was told nothing about a row nobody pressed.
 *
 * `window` rather than a flag passed in because it answers for the page this screen is
 * standing in, which is what the question is about, and because it is absent in a service
 * worker — which is what keeps the worker from asking itself.
 */
const arrivingOn = (reference: PullRequestRef): boolean =>
  typeof window !== "undefined" && claimArrival(window, reference)

/**
 * The seven payloads, read by the worker where there is one and here where there
 * is not.
 *
 * There is no worker in a test, in a page that has lost its extension to an update,
 * or in an install where messaging is refused. All three mean the same thing, which
 * is that this page reads GitHub the way it always did — a second or so slower on
 * arrival, and correct.
 */
export const payloadsThroughWorker = (
  reference: PullRequestRef
): Effect.Effect<RawPayloads, GatewayError> =>
  Effect.suspend(() => {
    if (!arrivingOn(reference)) return payloadsFor(reference)
    if (typeof browser === "undefined" || browser.runtime?.sendMessage === undefined) {
      return payloadsFor(reference)
    }

    return sending(reference).pipe(
      Effect.flatMap((answer) => {
        if (answer === undefined) return payloadsFor(reference)
        if (answer.ok) return Effect.succeed(answer.payloads)

        return Effect.fail(
          new GatewayError({
            reference,
            route: answer.route,
            reason: answer.reason,
            detail: answer.detail
          })
        )
      })
    )
  })

/**
 * The other end: what the worker sends back when the page asks.
 *
 * A failure is an answer rather than a rejection, for the reason at the top of the
 * file — a rejection does not carry its reason between realms, and the reason is
 * what the card the reader sees is made of.
 *
 * Handed the way to reply rather than returning one, because `onMessage` takes a
 * callback and holds the channel open for it, and because a read that is already in
 * the air here is a fiber rather than a promise.
 *
 * Answered on every way out, including the one nobody planned. `onMessage` has been
 * told an answer is coming, and a page waiting on a channel that is never written to
 * waits until Chrome notices, which is not on any schedule a reader would sit
 * through. A defect is the page's failure too, in the only words that can be sent.
 */
export const answering = (
  reference: PullRequestRef,
  read: (reference: PullRequestRef) => Effect.Effect<RawPayloads, GatewayError>,
  respond: (answer: Answered) => void
): void => {
  Effect.runFork(
    read(reference).pipe(
      Effect.map((payloads): Answered => ({ ok: true, payloads })),
      Effect.catch((failure) =>
        Effect.succeed<Answered>({
          ok: false,
          route: failure.route,
          reason: failure.reason,
          detail: failure.detail
        })
      ),
      // Whatever is left is a defect or an interruption rather than a read that
      // went wrong, and the page is owed a reply either way. `unreachable` because
      // that is what it amounts to from there: the question was asked and GitHub's
      // answer is not coming.
      Effect.catchCause((cause) =>
        Effect.succeed<Answered>({
          ok: false,
          route: CHANGES,
          reason: "unreachable",
          detail: Cause.pretty(cause)
        })
      ),
      Effect.tap((answer) => Effect.sync(() => respond(answer)))
    )
  )
}
