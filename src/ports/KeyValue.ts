/**
 * Somewhere to put things by name, and nothing more than that.
 *
 * Two adapters here keep things between visits — the settings a reader chose,
 * and the pull requests already read — and each had written down its own slice
 * of the same browser API under the same name. Two descriptions of one thing
 * means a second platform has two to satisfy, and a test standing in for storage
 * has to know which of them it is standing in for.
 *
 * Thenables rather than promises, because this describes an API somebody else
 * wrote and waiting on it is all that is wanted of it.
 */

export type KeyValue = {
  /**
   * One name or many, because the browser's own store takes either.
   *
   * Many matters on one path: a list draws two kept facts per row, and asking for
   * fifty names one at a time is fifty crossings of the extension's storage
   * boundary on the read whose whole purpose is to answer before the network does.
   */
  readonly get: (keys: string | Array<string>) => PromiseLike<Record<string, unknown>>
  readonly set: (items: Record<string, unknown>) => PromiseLike<void>
}

export type Changes = Record<string, { readonly newValue?: unknown }>

/**
 * A store that can be told when something in it changed, by anyone.
 *
 * Which is how two pull requests open side by side agree about how a diff is
 * drawn: the choice is made in one tab and the other is told.
 */
export type WatchedKeyValue = KeyValue & {
  readonly onChanged: {
    readonly addListener: (listener: (changes: Changes) => void) => void
    readonly removeListener: (listener: (changes: Changes) => void) => void
  }
}

/**
 * A store that can be made to let go of things.
 *
 * What a cache needs and a settings store does not: something has to fall off
 * the end, or forty pull requests becomes four hundred.
 */
export type ForgetfulKeyValue = KeyValue & {
  readonly remove: (keys: Array<string>) => PromiseLike<void>
}
