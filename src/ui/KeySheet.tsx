import { bindings, COMMAND_NAME, COMMAND_ORDER, type Command, type Profile } from "../keys/commands"
import { Cap } from "./Cap"

/** Nothing unbound, shared so a default prop is not a new array every render. */
const ALL_BOUND: ReadonlyArray<Command> = []

/**
 * Every shortcut that works here, written from the table that defines them.
 *
 * Generated rather than listed: a help sheet maintained by hand is wrong within
 * a month of the first binding being changed, and a wrong one is worse than
 * none — it teaches a key that does nothing.
 *
 * Some keys are only live while the panel that answers them is on. The tree's
 * filter is one: with the search box turned off, `/` is left to GitHub, whose
 * own search takes it and swallows whatever is typed next. Anything in the same
 * position is left out here rather than promised.
 */
export const KeySheet = ({
  profile,
  unbound = ALL_BOUND,
  onClose
}: {
  readonly profile: Profile
  /** Commands nothing on this page is listening for. */
  readonly unbound?: ReadonlyArray<Command>
  readonly onClose: () => void
}) => {
  const table = bindings(profile)

  return (
    // Escape is not handled here: the page's own keyboard owns it, and this
    // sheet is one of the things it closes.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="w-80 overflow-hidden rounded-md border border-line bg-raised shadow-pop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line bg-surface px-3 py-2 text-xs font-semibold">
          Keyboard
        </div>
        <ul className="divide-y divide-line-muted">
          {COMMAND_ORDER.map((command) => {
            const chords = table[command]
            if (chords.length === 0 || unbound.includes(command)) return null

            return (
              <li key={command} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 text-xs">{COMMAND_NAME[command]}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {chords.map((chord) => (
                    <Cap key={chord} chord={chord} />
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
