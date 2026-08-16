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
 *
 * Both answers are sums, which is the whole point of having a seam here.
 * Electrobun answers with every field always present and an empty `error` string
 * meaning nothing went wrong, so `{ updateAvailable: true, error: "…" }` is a
 * reading that can be taken and means nothing. `theUpdater` is the one place that
 * knows about the empty string; everything below reads a word.
 */
export type Found =
  | { readonly at: "none" }
  | { readonly at: "new"; readonly version: string }
  | { readonly at: "failed"; readonly why: string }

export type Fetched = { readonly at: "ready" } | { readonly at: "failed"; readonly why: string }

export type Ledger = {
  readonly channel: () => Promise<string>
  readonly look: () => Promise<Found>
  readonly fetch: () => Promise<Fetched>
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
    if (it.error !== "") return { at: "failed", why: it.error }
    return it.updateAvailable ? { at: "new", version: it.version } : { at: "none" }
  },

  fetch: async () => {
    const it = await updater()
    await it.downloadUpdate()
    // Read off the updater afterwards, because `downloadUpdate` answers with
    // nothing and reports by leaving `updateReady` or `error` behind it.
    const said = it.updateInfo()
    if (said?.updateReady === true) return { at: "ready" }
    return { at: "failed", why: said?.error === undefined || said.error === "" ? "The download did not finish." : said.error }
  },

  // Replaces the bundle and restarts, so nothing after this line runs.
  apply: async () => (await updater()).applyUpdate()
}

/**
 * How long the whole look gets before it is called off.
 *
 * Neither Electrobun's check nor its download has a deadline of its own, and the
 * download is twenty megabytes: a connection that stalls halfway leaves the
 * standing at `looking` for the rest of the run, and the window asks again every
 * three seconds for as long as it is open. Ten minutes is far longer than the
 * download takes on a bad connection and short enough to be a state that ends.
 */
const GIVE_UP_AFTER = 10 * 60 * 1000

const tooLong = (waitMs: number): Promise<UpdateStanding> =>
  new Promise((resolve) =>
    setTimeout(
      () => resolve({ at: "failed", why: "Looking for an update took too long." }),
      waitMs
    ).unref()
  )

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
export const watchForUpdates = (ledger: Ledger, waitMs: number = GIVE_UP_AFTER): Watch => {
  let standing: UpdateStanding = { at: "looking" }

  const wholeLook = async (): Promise<UpdateStanding> => {
    if ((await ledger.channel()) === "dev") return { at: "off" }

    const found = await ledger.look()
    if (found.at === "failed") return { at: "failed", why: found.why }
    if (found.at === "none") return { at: "current" }

    const got = await ledger.fetch()
    return got.at === "ready" ? { at: "ready", version: found.version } : got
  }

  const looked = (async () => {
    try {
      standing = await Promise.race([wholeLook(), tooLong(waitMs)])
    } catch (cause) {
      // Caught rather than left to reject: this runs while the window is opening,
      // and an unhandled rejection ends a Bun process — the app would fail to
      // open because a release page was briefly unreachable.
      standing = { at: "failed", why: cause instanceof Error ? cause.message : String(cause) }
    }
  })()

  return { standing: () => standing, looked }
}
