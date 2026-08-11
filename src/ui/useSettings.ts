import { Effect, UndefinedOr } from "effect"
import { useCallback, useEffect, useState } from "react"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { SCHEME_KEY } from "./applyTheme"
import { useSettingsStore } from "./settings"

/** Reading that cannot throw: no storage means keep what the store answered. */
const recall = UndefinedOr.liftThrowable((key: string) => localStorage.getItem(key))

/**
 * Lift a pre-settings desktop appearance into the store.
 *
 * The account menu used to write only `localStorage`. Appearance now lives on
 * `settings.theme`; without this, the first Theme paint would see the default
 * of system and overwrite a remembered light/dark choice.
 */
const withRecalledAppearance = (stored: Settings): Settings => {
  if (stored.theme.appearance !== "system") return stored

  const kept = recall(SCHEME_KEY)
  if (kept === "light" || kept === "dark") {
    return { ...stored, theme: { ...stored.theme, appearance: kept } }
  }
  return stored
}

/**
 * The reader's choices, applied as soon as they are made and kept afterwards.
 *
 * The defaults are shown while storage is being read — a frame or two — because
 * the alternative is an empty panel waiting on a disk, and the defaults are
 * what most readers will be looking at anyway. Changes made in another tab
 * arrive through the same path, so two pull requests open side by side do not
 * disagree about how a diff is drawn.
 *
 * `ready` flips after the first read so Theme does not paint the defaults into
 * `localStorage` and erase a scheme the desktop head script already applied.
 */
export const useSettings = () => {
  const held = useSettingsStore()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Interrupted rather than flagged: a read still in flight when the panel
    // closes is stopped by the fiber going away, so there is no late setState
    // against a component nobody is looking at any more.
    const reading = Effect.runFork(
      held.read.pipe(
        Effect.map((stored) => {
          const next = withRecalledAppearance(stored)
          setSettings(next)
          setReady(true)
          if (next.theme.appearance !== stored.theme.appearance) {
            Effect.runFork(held.write(next))
          }
        })
      )
    )
    const stop = held.watch((stored) => setSettings(stored))
    return () => {
      reading.interruptUnsafe()
      stop()
    }
  }, [held])

  /**
   * A change, applied to whatever the settings are now rather than to a copy of them.
   *
   * The function form exists because two changes made a second apart were losing one of
   * each other. A caller holding `settings` from its own last render spreads that value
   * into the one it writes, so the Rail remembering its width would write back the
   * Destination as it stood before the reader pressed it — found on the live page, where
   * narrowing the Rail undid the Destination that had just been chosen.
   *
   * Both forms are kept: most callers have one knob and a fresh render between presses.
   */
  const change = useCallback(
    (next: Settings | ((current: Settings) => Settings)) => {
      setSettings((current) => {
        const wanted = typeof next === "function" ? next(current) : next
        Effect.runFork(held.write(wanted))
        return wanted
      })
    },
    [held]
  )

  return { settings, change, ready }
}
