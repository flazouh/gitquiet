import { DEFAULTS, readSettings, type Settings, type View } from "./Settings"

/**
 * The slice of the extension storage API this needs, named so a test can stand
 * in for it and so the absence of the real one is a type rather than a crash.
 */
export type Area = {
  readonly get: (key: string) => Promise<Record<string, unknown>>
  readonly set: (items: Record<string, unknown>) => Promise<void>
  readonly onChanged?: {
    readonly addListener: (listener: (changes: Record<string, { newValue?: unknown }>) => void) => void
    readonly removeListener: (
      listener: (changes: Record<string, { newValue?: unknown }>) => void
    ) => void
  }
}

export type Store = {
  readonly read: () => Promise<Settings>
  readonly write: (settings: Settings) => Promise<void>
  /** Calls back when another tab changes a setting. Returns the way to stop. */
  readonly watch: (onChange: (settings: Settings) => void) => () => void
}

const KEY = "settings"

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
export const settingsStore = (area: Area | undefined): Store => {
  if (area === undefined) {
    let held = DEFAULTS
    return {
      read: async () => held,
      write: async (settings) => {
        held = settings
      },
      watch: () => () => {}
    }
  }

  return {
    read: async () => {
      try {
        const held = await area.get(KEY)
        return readSettings(held[KEY])
      } catch {
        return DEFAULTS
      }
    },
    write: async (settings) => {
      try {
        await area.set({ [KEY]: settings })
      } catch {
        // A choice that could not be stored still applies to this page; saying
        // so in a dialog would be louder than the problem.
      }
    },
    watch: (onChange) => {
      const listener = (changes: Record<string, { newValue?: unknown }>) => {
        const change = changes[KEY]
        if (change !== undefined) onChange(readSettings(change.newValue))
      }
      area.onChanged?.addListener(listener)
      return () => area.onChanged?.removeListener(listener)
    }
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
export const rememberView = async (store: Store, view: View): Promise<void> => {
  const held = await store.read()
  await store.write({ ...held, page: { ...held.page, view } })
}

/**
 * The real one, or a store that forgets, when the API is not there.
 *
 * Not there covers two cases worth keeping apart in the head: a test, where
 * there is no extension at all, and a browser that has taken the permission
 * away — from the interface's side both mean the same thing, which is that
 * choices apply to this page and are gone with it.
 */
export const browserSettings = (): Store => {
  if (typeof browser === "undefined") return settingsStore(undefined)

  const area = browser.storage?.sync
  if (area === undefined) return settingsStore(undefined)

  return settingsStore({
    get: (key) => area.get(key),
    set: (items) => area.set(items),
    onChanged: area.onChanged
  })
}
