import { Duration, Effect } from "effect"
import { DEFAULTS, type View } from "../domain/Settings"
import type { Store } from "../ports/Settings"

/**
 * Choices that last as long as the page does.
 *
 * What is left when there is nowhere to keep them: a test, a browser that has
 * taken the storage permission away, an interface rendered outside any shell at
 * all. Every one of those means the same thing from here, which is that a choice
 * applies to what the reader is looking at and is gone afterwards — which is far
 * better than a panel that refuses to draw because a disk said no.
 */
export const forgetful = (): Store => {
  let held = DEFAULTS

  return {
    read: Effect.sync(() => held),
    write: (settings) =>
      Effect.sync(() => {
        held = settings
      }),
    watch: () => () => {}
  }
}

/**
 * Writes down which page to open, leaving every other choice as it was.
 *
 * Read then write rather than write alone, because this is called from a page
 * that may have been open since before the reader changed something in another
 * tab, and writing the whole settings object from a stale copy would quietly
 * undo it.
 */
export const rememberView = (store: Store, view: View): Effect.Effect<void> =>
  Effect.gen(function* () {
    const held = yield* store.read
    yield* store.write({ ...held, page: { ...held.page, view } })
  })

/**
 * How long the page waits to be told which interface the reader chose.
 *
 * The same setting every page here reads: it is the one switch for turning this
 * extension off, and honouring it on one page while ignoring it on another
 * would mean turning it off did not turn it off.
 *
 * A read of extension storage is a few milliseconds, so this is not a wait
 * anybody experiences; it is what happens if storage never answers at all.
 */
const CHOICE = 250

/**
 * Which interface to put up, with ours as the answer when storage is silent.
 *
 * Every content script asks this before it draws anything, and each of them
 * used to write the race out again.
 */
export const chosenView = (store: Store): Effect.Effect<View> =>
  store.read.pipe(
    Effect.map((settings) => settings.page.view),
    Effect.timeoutOrElse({
      duration: Duration.millis(CHOICE),
      orElse: () => Effect.succeed<View>("ours")
    })
  )
