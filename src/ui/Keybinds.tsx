import { useEffect, useRef, useState } from "react"
import { withBound } from "../app/keyboard"
import type { Settings } from "../domain/Settings"
import {
  bindings,
  type Chord,
  type Command,
  isChord,
  KEYBOARD,
  type Keys
} from "../keys/commands"
import { theirs } from "../keys/match"
import { Cap } from "./Cap"

/**
 * Every command, the key it answers to, and the way to change it.
 *
 * A row per command rather than a knob per command, because a knob is a choice
 * between answers this interface knows the whole of and the answer here is any
 * key on the board. So the control is the board: press the row, then press the
 * key you want, and the row wears it.
 *
 * One press makes one chord. The sequences behind `g` stay where the profile put
 * them until a reader writes over one, and writing over one replaces the whole
 * sequence with the single key they pressed — which is the honest reading of
 * what they did, and it is what the row then shows.
 */

export type KeybindsProps = {
  readonly settings: Settings
  readonly onChange: (settings: Settings) => void
  /** What the rows are read against, which is the profile plus these same changes. */
  readonly keys: Keys
}

/**
 * The key a press amounts to, or nothing when it is not the reader's to give.
 *
 * The same rule the matcher itself keeps: anything held with Command, Control or
 * Alt belongs to the browser and to the operating system, and a modifier held on
 * its own is not a key being typed. Shift is not one of those — it is how a
 * reader reaches half the board, and `A` arrives as `A`.
 *
 * Escape is the way out of the recording rather than a key to record. Every
 * dialog, menu and bubble on this page is listening for it, so a command bound
 * to it would be a command that fires behind whatever the reader was closing.
 */
const chordIn = (event: React.KeyboardEvent): Chord | null => {
  const press = {
    key: event.key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  }
  if (theirs(press) || event.key === "Escape") return null
  return isChord(event.key) ? event.key : null
}

const Row = ({
  word,
  gist,
  chord,
  taking,
  onTake,
  onSet,
  onStop,
  onPutBack,
  changed
}: {
  readonly word: string
  readonly gist: string
  readonly chord: Chord | null
  readonly taking: boolean
  readonly onTake: () => void
  readonly onSet: (chord: Chord) => void
  /** Stops listening, leaving the key exactly as it was. */
  readonly onStop: () => void
  /** Gives the command back the key its profile has for it. */
  readonly onPutBack: () => void
  readonly changed: boolean
}) => {
  const face = useRef<HTMLButtonElement | null>(null)

  // The button takes the keyboard the moment it starts listening, so the next
  // press lands on it rather than on the page behind the dialog.
  useEffect(() => {
    if (taking) face.current?.focus()
  }, [taking])

  return (
    <li className="flex items-center gap-4 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink">{word}</span>
        <span className="text-xs text-ink-muted">{gist}</span>
      </div>
      {changed ? (
        <button
          type="button"
          onClick={onPutBack}
          title={`Put ${word} back on the key the profile gives it`}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-ink-muted hover:bg-hover hover:text-ink"
        >
          Put back
        </button>
      ) : null}
      <button
        ref={face}
        type="button"
        aria-label={`Change the key for ${word}`}
        onClick={onTake}
        onBlur={taking ? onStop : undefined}
        onKeyDown={(event) => {
          if (!taking) return
          // Every press while this is listening, including the ones this refuses:
          // a Tab that moved the focus out mid-recording would leave the row
          // waiting for a key the reader has stopped giving it.
          event.preventDefault()
          event.stopPropagation()

          if (event.key === "Escape") {
            onStop()
            face.current?.blur()
            return
          }
          const wanted = chordIn(event)
          if (wanted !== null) onSet(wanted)
        }}
        className={`flex h-6 min-w-16 shrink-0 items-center justify-center rounded-md px-2 text-xs ${
          taking
            ? "bg-accent-emphasis text-ink-on-emphasis"
            : "bg-canvas text-ink-muted hover:bg-hover hover:text-ink"
        }`}
      >
        {taking ? "Press a key" : chord === null ? "None" : <Cap chord={chord} />}
      </button>
    </li>
  )
}

export const Keybinds = ({ settings, onChange, keys }: KeybindsProps) => {
  const [taking, setTaking] = useState<Command | null>(null)
  const table = bindings(keys)

  if (keys.profile === "off") {
    return (
      <p className="py-3 text-sm text-ink-muted">
        The keyboard is off, so none of these keys reach this interface and GitHub's own
        shortcuts work here as they do on every other page. Turn it back on above to change
        one.
      </p>
    )
  }

  return (
    <ul>
      {KEYBOARD.map(({ command, word, gist }) => (
        <Row
          key={command}
          word={word}
          gist={gist}
          chord={table[command][0] ?? null}
          taking={taking === command}
          changed={settings.bound[command] !== undefined}
          onTake={() => setTaking(command)}
          onStop={() => setTaking(null)}
          onSet={(chord) => {
            setTaking(null)
            onChange(withBound(settings, command, chord))
          }}
          onPutBack={() => {
            setTaking(null)
            onChange(withBound(settings, command, null))
          }}
        />
      ))}
    </ul>
  )
}
