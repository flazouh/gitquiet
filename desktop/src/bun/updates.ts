/**
 * Keeping the app current, which a reader should have to think about once.
 *
 * Electrobun ships the mechanism: a signed tarball per channel behind a URL, a
 * hash to compare against the running build, a patch when one exists so the
 * usual update is a few hundred kilobytes rather than twenty megabytes, and a
 * restart that swaps the bundle in place. What is here is when to use it and what
 * the window is allowed to say about it.
 *
 * The shape is deliberate: look and fetch on launch, without asking, and then
 * say one thing when it is ready. An app that asks permission to look, asks
 * again to download, and then asks a third time to restart has spent three of
 * somebody's decisions on an outcome they never wanted to be involved in. The
 * one press left is the restart, because that one interrupts what they are doing.
 *
 * Nothing here verifies a signature of its own. What it rests on is macOS: the
 * tarball holds a bundle signed with the Developer ID this project releases
 * under and notarised by Apple, and the system refuses to launch a bundle whose
 * signature does not match what it was notarised as. That is the same check that
 * guards the disk image somebody downloaded in the first place.
 */

import type { UpdateStanding } from "../shared/wire"

/**
 * The updater, as the four things this file asks of it.
 *
 * A seam rather than a mock: what is worth testing is the order — never fetch
 * what was not found, never say ready when the download did not finish — and
 * every one of those cases in the real updater is a network round trip and a
 * twenty megabyte write.
 */
export type Ledger = {
  readonly channel: () => Promise<string>
  readonly look: () => Promise<{
    readonly updateAvailable: boolean
    readonly version: string
    readonly error: string
  }>
  readonly fetch: () => Promise<{ readonly ready: boolean; readonly error: string }>
  readonly apply: () => Promise<void>
}

/**
 * Reached for when it is used rather than when this file is read.
 *
 * Importing `electrobun/bun` runs the updater's own start-up, which reads the
 * `version.json` from inside an app bundle and prints a stack trace where there
 * is no bundle around it — a test, or a script under `scripts/`. The module is
 * cached after the first call, so this costs one lookup.
 */
const updater = async () => (await import("electrobun/bun")).Updater

export const theUpdater: Ledger = {
  channel: async () => (await (await updater()).getLocalInfo()).channel,
  look: async () => {
    const it = await (await updater()).checkForUpdate()
    return { updateAvailable: it.updateAvailable, version: it.version, error: it.error }
  },
  fetch: async () => {
    const it = await updater()
    await it.downloadUpdate()
    const said = it.updateInfo()
    return { ready: said?.updateReady === true, error: said?.error ?? "" }
  },
  // Replaces the bundle and restarts, so nothing after this line runs.
  apply: async () => (await updater()).applyUpdate()
}

export type Watch = {
  readonly standing: () => UpdateStanding
  /** Settles when the first look is over, whichever way it went. */
  readonly looked: Promise<void>
}

/**
 * Looks once, on launch, and holds what it found.
 *
 * Held here rather than pushed to the window, because the window is drawn after
 * this starts and asks for the standing when it is: a message sent to a webview
 * that does not exist yet is a message nobody hears, and it would need a channel
 * from this process into the interface that nothing else in this app needs.
 */
export const watchForUpdates = (ledger: Ledger): Watch => {
  let standing: UpdateStanding = { at: "looking" }

  const looked = (async () => {
    try {
      if ((await ledger.channel()) === "dev") {
        standing = { at: "off" }
        return
      }

      const found = await ledger.look()
      if (found.error !== "") {
        standing = { at: "failed", why: found.error }
        return
      }

      if (!found.updateAvailable) {
        standing = { at: "current" }
        return
      }

      const got = await ledger.fetch()
      standing = got.ready
        ? { at: "ready", version: found.version }
        : { at: "failed", why: got.error === "" ? "The download did not finish." : got.error }
    } catch (cause) {
      // Caught rather than left to reject: this runs while the window is opening,
      // and an unhandled rejection there is an app that does not open because a
      // release page was briefly unreachable.
      standing = { at: "failed", why: cause instanceof Error ? cause.message : String(cause) }
    }
  })()

  return { standing: () => standing, looked }
}
