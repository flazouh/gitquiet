import { type Bound, type Command, type Chord, isChord, KEYBOARD, type Keys } from "../keys/commands"
import type { Settings } from "../domain/Settings"

/**
 * What the reader chose, as the keyboard reads it.
 *
 * Two halves that are stored apart and used together. The profile is a knob, so
 * it is validated against its own choices where every other knob is; the chords
 * cannot be — any key on the board is an answer — so the storage promises only
 * that both halves are strings, and this is where a command that no longer
 * exists and a chord that could never be pressed are dropped.
 *
 * Kept out of `domain/choices.ts`, which does this same job for the diff and the
 * rail, because that file answers to the renderers and this one answers to the
 * matcher: the commands are the keyboard's vocabulary and the domain has no
 * business holding a second copy of them.
 */

const NAMED: ReadonlySet<string> = new Set<string>(KEYBOARD.map((one) => one.command))

const isCommand = (name: string): name is Command => NAMED.has(name)

/** The reader's own chords, with anything the matcher could not use left out. */
export const boundIn = (stored: Readonly<Record<string, string>>): Bound =>
  Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [Command, Chord] => isCommand(entry[0]) && isChord(entry[1])
    )
  )

export const keysOf = (settings: Settings): Keys => ({
  profile: settings.keys.profile,
  bound: boundIn(settings.bound)
})

/**
 * The same settings with one command answering to one chord, or back to its own.
 *
 * `null` puts a command back rather than binding it to nothing, because a
 * command bound to nothing is what turning the whole keyboard off is for and a
 * row that could do it one command at a time would be eleven ways to arrive at
 * a keyboard the reader cannot explain.
 */
export const withBound = (settings: Settings, command: Command, chord: Chord | null): Settings => {
  const bound: Record<string, string> = { ...settings.bound }
  if (chord === null) delete bound[command]
  else bound[command] = chord
  return { ...settings, bound }
}
