import { describe, expect, test } from "bun:test"
import type { Ledger } from "./updates"
import { watchForUpdates } from "./updates"

/**
 * A stand-in for Electrobun's updater, which is the one part of this that
 * downloads twenty megabytes and replaces the running application.
 */
const ledger = (it: {
  readonly channel?: string
  readonly look?: Ledger["look"]
  readonly fetch?: Ledger["fetch"]
}): Ledger => ({
  channel: async () => it.channel ?? "stable",
  look: it.look ?? (async () => ({ at: "none" })),
  fetch: it.fetch ?? (async () => ({ at: "ready" })),
  apply: async () => {}
})

describe("watchForUpdates", () => {
  test("checks nothing in a dev build, which has no release to check against", async () => {
    const watch = watchForUpdates(ledger({ channel: "dev" }))
    await watch.looked

    expect(watch.standing()).toEqual({ at: "off" })
  })

  test("is looking before the first answer arrives", () => {
    const watch = watchForUpdates(ledger({}))

    expect(watch.standing()).toEqual({ at: "looking" })
  })

  test("says so when this is already the latest build", async () => {
    const watch = watchForUpdates(ledger({}))
    await watch.looked

    expect(watch.standing()).toEqual({ at: "current" })
  })

  test("fetches what it found, and names the version once it is ready", async () => {
    let fetched = 0
    const watch = watchForUpdates(
      ledger({
        look: async () => ({ at: "new", version: "0.3.0" }),
        fetch: async () => {
          fetched++
          return { at: "ready" }
        }
      })
    )
    await watch.looked

    expect(fetched).toBe(1)
    expect(watch.standing()).toEqual({ at: "ready", version: "0.3.0" })
  })

  test("does not fetch anything when there is nothing new", async () => {
    let fetched = 0
    const watch = watchForUpdates(
      ledger({
        fetch: async () => {
          fetched++
          return { at: "ready" }
        }
      })
    )
    await watch.looked

    expect(fetched).toBe(0)
  })

  test("carries the reason a check was refused", async () => {
    const watch = watchForUpdates(
      ledger({ look: async () => ({ at: "failed", why: "Failed to fetch update info" }) })
    )
    await watch.looked

    expect(watch.standing()).toEqual({ at: "failed", why: "Failed to fetch update info" })
  })

  test("carries the reason a download did not finish", async () => {
    const watch = watchForUpdates(
      ledger({
        look: async () => ({ at: "new", version: "0.3.0" }),
        fetch: async () => ({ at: "failed", why: "Failed to download latest version" })
      })
    )
    await watch.looked

    expect(watch.standing()).toEqual({ at: "failed", why: "Failed to download latest version" })
  })

  /*
   * The one state that could otherwise never end: neither the check nor the
   * download has a deadline of its own, and the window asks again every three
   * seconds for as long as the standing is `looking`.
   */
  test("gives up on a download that never finishes", async () => {
    const watch = watchForUpdates(
      ledger({
        look: async () => ({ at: "new", version: "0.3.0" }),
        fetch: () => new Promise<never>(() => {})
      }),
      10
    )
    await watch.looked

    expect(watch.standing()).toEqual({ at: "failed", why: "Looking for an update took too long." })
  })

  /*
   * A throw rather than an answer, because the updater reaches the network and
   * the disk. Every one of these runs on launch, where an unhandled rejection is
   * an app that does not open.
   */
  test("stays standing when the updater throws", async () => {
    const watch = watchForUpdates(
      ledger({
        look: async () => {
          throw new Error("the tunnel collapsed")
        }
      })
    )
    await watch.looked

    expect(watch.standing()).toEqual({ at: "failed", why: "the tunnel collapsed" })
  })
})
