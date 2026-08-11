/**
 * A stand-in for `browser.storage.local`, which does not exist outside an
 * extension.
 *
 * The store behind the gateway is internal rather than a seam — there is one
 * seam in this system and it is `GitHubGateway` — so a test that wants to watch
 * a pull request being remembered replaces the browser API underneath it rather
 * than injecting something in its place. The same trick `fake-indexeddb` plays,
 * for the API we happen to use.
 */
const held = new Map<string, unknown>()

export const forgetEverything = (): void => {
  held.clear()
}

/** What is in the store, for a test that wants to assert on it directly. */
export const stored = (key: string): unknown => held.get(key)

/**
 * Puts something in the store that the code under test would never write —
 * an entry left by an older build, most usefully.
 */
export const place = (key: string, value: unknown): void => {
  held.set(key, value)
}

export const installStorage = (): void => {
  Object.assign(globalThis, {
    browser: {
      storage: {
        local: {
          // One name or many, as the real one takes: a list asks for every row's
          // kept facts in a single read.
          get: (keys: string | Array<string>) =>
            Promise.resolve(
              Object.fromEntries(
                (Array.isArray(keys) ? keys : [keys]).map((key) => [key, held.get(key)])
              )
            ),
          set: (items: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(items)) held.set(key, value)
            return Promise.resolve()
          },
          remove: (keys: Array<string>) => {
            for (const key of keys) held.delete(key)
            return Promise.resolve()
          }
        }
      }
    }
  })
}
