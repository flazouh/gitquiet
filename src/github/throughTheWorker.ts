import { Effect } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GatewayError, type GatewayFailure } from "../ports/GitHubGateway"
import { payloadsFor } from "./asking"
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

/** Whether a message off the wire is the one question this file is about. */
export const isAsked = (message: unknown): message is Asked =>
  typeof message === "object" &&
  message !== null &&
  (message as { what?: unknown }).what === ASKING

/**
 * The worker's answer, put back into the failure the page would have raised itself.
 *
 * A rejected `sendMessage` and an answer in a shape this does not recognise are both
 * treated as no worker at all, which is what {@link payloadsThroughWorker} falls back
 * on. Anything else would trade a pull request for a plumbing failure.
 */
const asAnswered = (value: unknown): Answered | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const answer = value as { ok?: unknown }
  if (answer.ok === true) return value as Answered
  if (answer.ok === false) return value as Answered

  return undefined
}

const sending = (reference: PullRequestRef): Effect.Effect<Answered | undefined> =>
  Effect.tryPromise(() => browser.runtime.sendMessage(askingFor(reference))).pipe(
    Effect.map(asAnswered),
    Effect.catch(() => Effect.succeed(undefined))
  )

/**
 * Whether this document is still arriving, which is the only time the worker is
 * worth asking.
 *
 * A worker that has been idle for thirty seconds is stopped, and waking it took 587
 * milliseconds when this extension last depended on that — see `background.ts`.
 * Asking it for every read would put that in front of the two the reader notices
 * most, a press and a Back, both of which happen on a document that finished
 * loading long ago and neither of which the worker has been told about.
 *
 * A navigation is the opposite case on every count. It wakes the worker itself,
 * seconds before this runs, and the read it starts there is the one being joined.
 *
 * `complete` rather than a flag of our own because it is the browser's own answer to
 * the same question, and it is false in a service worker, which is what keeps the
 * worker from asking itself.
 */
const stillArriving = (): boolean =>
  typeof document !== "undefined" && document.readyState !== "complete"

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
    if (!stillArriving()) return payloadsFor(reference)
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
      Effect.tap((answer) => Effect.sync(() => respond(answer)))
    )
  )
}
