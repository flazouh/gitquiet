export type Kept<Key, Value> = {
  /** The value, from memory if it is there and from the reader if not. */
  readonly ask: (key: Key) => Promise<Value>
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
 * Failures are deliberately not kept. A refusal or a dropped connection says
 * nothing about the thing being read, and remembering it would turn one bad
 * moment into a permanently broken row.
 *
 * Nothing here knows about React, GitHub or commits, which is what makes it
 * worth having once rather than three times.
 */
export const keptReads = <Key, Value>(read: (key: Key) => Promise<Value>): Kept<Key, Value> => {
  const held = new Map<Key, Value>()
  const waiting = new Map<Key, Promise<Value>>()

  const ask = (key: Key): Promise<Value> => {
    const already = held.get(key)
    if (already !== undefined) return Promise.resolve(already)

    const inFlight = waiting.get(key)
    if (inFlight !== undefined) return inFlight

    const promise = read(key).then(
      (value) => {
        held.set(key, value)
        waiting.delete(key)
        return value
      },
      (cause: unknown) => {
        waiting.delete(key)
        throw cause
      }
    )

    waiting.set(key, promise)
    return promise
  }

  return {
    ask,
    // The rejection is swallowed here and only here: nobody is waiting on a
    // warm, and an unhandled rejection from one would be reported as though
    // something a reader did had failed.
    warm: (key) => {
      if (held.has(key) || waiting.has(key)) return
      void ask(key).catch(() => {})
    },
    held: (key) => held.get(key)
  }
}
