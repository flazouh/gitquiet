import { Deferred, Effect, Exit } from "effect"

export type Kept<Key, Value> = {
  /** The value, from memory if it is there and from the reader if not. */
  readonly ask: (key: Key) => Effect.Effect<Value, unknown>
  /** Read it now so that asking later costs nothing. Failures are not reported. */
  readonly warm: (key: Key) => void
  /** What is already in hand, for whoever can show it without waiting. */
  readonly held: (key: Key) => Value | undefined
}

/**
 * Anything read by a key, read once.
 *
 * The same commit opened twice is the same commit: a sha names a thing that
 * cannot change, so fetching it again can only produce the answer already on
 * hand, a second slower. This keeps the first answer and hands it back, and
 * folds together the reads for one key that are in the air at once — hovering a
 * row and then clicking it is one request, not two.
 *
 * The read is forked rather than run by whoever asked, and that is the point of
 * the deferred: a reader who closes the dialog interrupts their own waiting and
 * nobody else's, so the answer still arrives for the two other places asking for
 * it and for the next person to open the same thing.
 *
 * Failures are deliberately not kept. A refusal or a dropped connection says
 * nothing about the thing being read, and remembering it would turn one bad
 * moment into a permanently broken row.
 *
 * Nothing here knows about React, GitHub or commits, which is what makes it
 * worth having once rather than three times.
 */
export const keptReads = <Key, Value>(
  read: (key: Key) => Effect.Effect<Value, unknown>,
  /**
   * What names the key in memory, where the key itself cannot: an object built
   * at the call site is a fresh identity every time, so two asks for one thing
   * would never meet. Left out, the key names itself, which is right for the
   * strings and numbers every earlier caller passes.
   */
  by: (key: Key) => unknown = (key) => key
): Kept<Key, Value> => {
  const held = new Map<unknown, Value>()
  const waiting = new Map<unknown, Deferred.Deferred<Value, unknown>>()

  const start = (key: Key): Deferred.Deferred<Value, unknown> => {
    const asking = Deferred.makeUnsafe<Value, unknown>()
    waiting.set(by(key), asking)

    Effect.runFork(
      Effect.exit(read(key)).pipe(
        Effect.map((answer) => {
          waiting.delete(by(key))
          if (Exit.isSuccess(answer)) held.set(by(key), answer.value)
          Deferred.doneUnsafe(asking, answer)
        })
      )
    )

    return asking
  }

  const ask = (key: Key): Effect.Effect<Value, unknown> =>
    Effect.suspend(() => {
      const already = held.get(by(key))
      if (already !== undefined) return Effect.succeed(already)

      return Deferred.await(waiting.get(by(key)) ?? start(key))
    })

  return {
    ask,
    // The failure is swallowed here and only here: nobody is waiting on a warm,
    // and letting one fail would report it as though something a reader did had
    // gone wrong.
    warm: (key) => {
      if (held.has(by(key)) || waiting.has(by(key))) return
      start(key)
    },
    held: (key) => held.get(by(key))
  }
}
