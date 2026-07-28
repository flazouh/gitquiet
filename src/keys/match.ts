import { bindings, type Command, type Profile } from "./commands"

/** A keypress, reduced to the part a binding is allowed to care about. */
export type Press = {
  readonly key: string
  readonly ctrl?: boolean
  readonly meta?: boolean
  readonly alt?: boolean
  readonly shift?: boolean
}

/**
 * The command a keypress asks for, or nothing.
 *
 * Anything held with Command, Control or Alt is left alone without even
 * looking: those belong to the browser and to the operating system, and a
 * single-letter shortcut that also fires on Cmd+J is a shortcut that breaks
 * jumping to a tab. Shift is not treated that way — `?` is a shifted key and
 * arrives as `?`, so the key itself already says whether shift was down.
 */
export const commandFor = (press: Press, profile: Profile): Command | null => {
  if (press.ctrl === true || press.meta === true || press.alt === true) return null

  const table = bindings(profile)
  for (const [command, chords] of Object.entries(table)) {
    if (chords.includes(press.key)) return command as Command
  }
  return null
}
