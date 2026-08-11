/**
 * The window's own storage, reached once and guarded once.
 *
 * Three places in the view were each doing this differently: the read cache
 * wrapped its writes in a catch but not its reads, the scheme hook had its own
 * pair of try blocks, and the settings store's `set` had none at all — so a
 * window over quota answered a changed setting with a rejected promise rather
 * than with a setting that changes and forgets by morning.
 *
 * All three want the same thing, which is storage that cannot throw. Not because
 * a failure here is impossible, but because none of the ways it fails — a webview
 * with storage disabled, a quota already spent, a private session — is a reason
 * to refuse to draw a pull request. Every call answers as if nothing had ever
 * been kept, which is the truth in each of those cases.
 */

/**
 * Somewhere to put things by name: `localStorage` in the window, a Map in a test.
 *
 * Injected rather than reached for, because the callers are worth testing and
 * `bun test` is not a webview. The same shape `Storage` has, narrowed to the
 * three things anything here does with it.
 */
export type Somewhere = {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
}

const guarded = (store: Storage): Somewhere => ({
  getItem: (key) => {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      store.setItem(key, value)
    } catch {
      // Nothing. The window carries on with the value it has in memory and the
      // next launch starts fresh, which is where every reader started anyway.
    }
  },
  removeItem: (key) => {
    try {
      store.removeItem(key)
    } catch {
      // As above.
    }
  }
})

/**
 * `localStorage`, if there is one that will answer, and nothing if there is not.
 *
 * Reaching for the object itself can throw before a single key is read — a
 * webview with storage disabled by policy does exactly that — so the probe is
 * inside the try as well.
 */
export const inThisWindow = (): Somewhere | null => {
  try {
    if (typeof localStorage === "undefined") return null
    return guarded(localStorage)
  } catch {
    return null
  }
}
