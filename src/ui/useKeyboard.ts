import { useMemo } from "react"
import { keysOf } from "../app/keyboard"
import type { Keys } from "../keys/commands"
import { useSettings } from "./useSettings"

/**
 * The keyboard the reader chose, for a surface that was not handed one.
 *
 * Every component that answers a command takes `keys` as a prop, because the
 * onboarding and the tests draw these screens against fixtures rather than
 * against storage. This is what the prop falls back to, and it is what almost
 * every real screen ends up using: the profile and the reader's own chords, read
 * from the same store the rest of the settings come out of.
 *
 * Held rather than made fresh, because `useKeys` takes its listener off the
 * document and puts it back whenever the profile changes, and a new object on
 * every render would be a new profile as far as a dependency check is concerned.
 */
export const useKeyboard = (given?: Keys): Keys => {
  const { settings } = useSettings()
  const chosen = useMemo(() => keysOf(settings), [settings])
  return given ?? chosen
}
