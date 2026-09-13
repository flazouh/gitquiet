/**
 * How many Ledgers this document holds, and which one it lets go of.
 *
 * The policy, without a document: a reader moves between repositories, and the
 * one they came back to should not have to be read again. What it lets go of is
 * on disk, so coming back to that one is a list read rather than an archive
 * fetched — which is why holding few is cheap to be wrong about.
 */

/** Newest asked-for last, which is what makes the oldest the first one out. */
export type Holding<A> = Map<string, A>

export const holdingOf = <A>(): Holding<A> => new Map()

/** The one asked for, moved to the newest end. */
export const heldIn = <A>(holding: Holding<A>, at: string): A | undefined => {
  const found = holding.get(at)
  if (found === undefined) return undefined

  holding.delete(at)
  holding.set(at, found)
  return found
}

/** Puts one in, and lets go of the least recently asked-for beyond `most`. */
export const holdIn = <A>(holding: Holding<A>, at: string, value: A, most: number): void => {
  holding.delete(at)
  holding.set(at, value)

  while (holding.size > most) {
    const oldest = holding.keys().next().value
    if (oldest === undefined) break
    holding.delete(oldest)
  }
}
