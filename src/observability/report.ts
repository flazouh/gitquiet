import { Effect } from "effect"

/**
 * Where a swallowed failure goes, which is the reader's own console and nowhere else.
 *
 * This extension used to carry Sentry, fetched behind a DSN check so that a build
 * without one downloaded nothing. That was true and it was still the wrong shape to
 * ship. The library was in the bundle either way, and a reviewer reading the bundle
 * finds Sentry there — so "this app sends nothing anywhere" became a sentence that
 * needed a paragraph of explanation every time it was said, to Apple's reviewers and to
 * anybody reading the source. A dependency that has to be explained to be believed is
 * cheaper to remove than to keep.
 *
 * So: no reporting service, no endpoint, no third party, nothing to disclose. What was
 * a report is a line in the console of the browser it happened in, which is where the
 * only person who can act on it is already looking.
 *
 * Every call site is unchanged and deliberate. These are failures the code has decided
 * to carry on through — a read that failed behind a screen that still drew, a write
 * whose refusal was already shown to the reader — and dropping them silently is how a
 * bug becomes unreproducible. Saying them out loud costs nothing and is sometimes the
 * only trace there is.
 */
export const reportError = (error: unknown): void => {
  // `console.error` rather than a throw, because every caller here has already decided
  // the failure is survivable. Throwing would turn a handled case into an unhandled one.
  console.error("[gitquiet]", error)
}

/**
 * A failure the caller has decided to survive, said out loud on its way past.
 *
 * `Effect.catch(onward)` is the shape this replaces, and it was the
 * wrong one everywhere it appeared. It reads as "this is allowed to fail",
 * which is usually true, but what it compiles to is "nobody will ever learn
 * that it did". Following spent a day unfindable behind exactly that: a name
 * that would not underline in a diff, a resolver that never answered, and not
 * one line anywhere saying which of the two it was.
 *
 * So the decision to carry on is kept and the silence is not. Same control
 * flow, same value, one line in the console naming the cause — which, per the
 * note above, is the only trace this extension keeps anywhere.
 */
export const onward = (cause: unknown): Effect.Effect<void> =>
  Effect.sync(() => reportError(cause))

/**
 * The same, where carrying on means answering with something rather than
 * nothing: an empty list, a `null`, an `Option.none`.
 */
export const onwardWith =
  <A,>(value: A) =>
  (cause: unknown): Effect.Effect<A> =>
    Effect.sync(() => {
      reportError(cause)
      return value
    })
