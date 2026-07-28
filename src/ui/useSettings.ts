import { useCallback, useEffect, useMemo, useState } from "react"
import { DEFAULTS, type Settings } from "../settings/Settings"
import { browserSettings, type Store } from "../settings/store"

/**
 * The reader's choices, applied as soon as they are made and kept afterwards.
 *
 * The defaults are shown while storage is being read — a frame or two — because
 * the alternative is an empty panel waiting on a disk, and the defaults are
 * what most readers will be looking at anyway. Changes made in another tab
 * arrive through the same path, so two pull requests open side by side do not
 * disagree about how a diff is drawn.
 */
export const useSettings = (store?: Store) => {
  // Built once. A store made in the argument list is a new store every render,
  // and a new store is a new read, a new state, and a render loop.
  const held = useMemo(() => store ?? browserSettings(), [store])
  const [settings, setSettings] = useState<Settings>(DEFAULTS)

  useEffect(() => {
    let live = true
    void held.read().then((stored) => {
      if (live) setSettings(stored)
    })
    const stop = held.watch((stored) => setSettings(stored))
    return () => {
      live = false
      stop()
    }
  }, [held])

  const change = useCallback(
    (next: Settings) => {
      setSettings(next)
      void held.write(next)
    },
    [held]
  )

  return { settings, change }
}
