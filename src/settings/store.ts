import { Effect } from "effect"
import type { WatchedKeyValue } from "../ports/KeyValue"
import { forgetful } from "../app/settings"
import type { Store } from "../ports/Settings"
import { DEFAULTS, readSettings } from "../domain/Settings"
import { SETTINGS } from "../ui/keeping"

const KEY = SETTINGS

/**
 * Settings kept where Chrome syncs them.
 *
 * Sync rather than local because a reader who chose side-by-side diffs on the
 * laptop meant it on the desktop too, and because these are a few hundred bytes
 * of words — well inside the hundred kilobytes sync allows.
 *
 * Every failure here is answered with the defaults rather than with an error:
 * storage can be unavailable, over quota, or disabled by policy, and none of
 * those are worth refusing to show a pull request over.
 */
export const settingsStore = (area: WatchedKeyValue | undefined): Store => {
  if (area === undefined) return forgetful()

  return {
    read: Effect.tryPromise(() => area.get(KEY)).pipe(
      Effect.map((held) => readSettings(held[KEY])),
      Effect.catch(() => Effect.succeed(DEFAULTS))
    ),
    // A choice that could not be stored still applies to this page; saying so
    // in a dialog would be louder than the problem.
    write: (settings) => Effect.tryPromise(() => area.set({ [KEY]: settings })).pipe(Effect.ignore),
    watch: (onChange) => {
      const listener = (changes: Record<string, { newValue?: unknown }>) => {
        const change = changes[KEY]
        if (change !== undefined) onChange(readSettings(change.newValue))
      }
      area.onChanged.addListener(listener)
      return () => area.onChanged.removeListener(listener)
    }
  }
}

