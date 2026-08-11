import type { Effect } from "effect"
import type { Settings } from "../domain/Settings"

/**
 * Where a reader's choices are kept, said without saying where that is.
 *
 * Three things, because three things are all anybody does with settings: read
 * them, write them, and be told when another tab wrote them. Chrome's synced
 * storage satisfies this; so would a file on a desktop, a row in a database, or
 * an object that holds them for as long as the page is open.
 *
 * A port, so it names the domain and nothing else. Whoever satisfies it is
 * somebody else's problem, and the pure work over it — remembering which page to
 * open, deciding which interface to put up — lives in `app/settings.ts`.
 */
export type Store = {
  readonly read: Effect.Effect<Settings>
  readonly write: (settings: Settings) => Effect.Effect<void>
  /** Calls back when another tab changes a setting. Returns the way to stop. */
  readonly watch: (onChange: (settings: Settings) => void) => () => void
}
