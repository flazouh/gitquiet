import { useState } from "react"

/**
 * The two things both gist screens draw, written once.
 *
 * A row on the list and the head of one gist show the same counts and offer the same
 * editor, and they had the same forty lines apiece to do it. Two copies of a form is two
 * places to fix the next thing wrong with it, and the copy nobody remembers is the one
 * that keeps the bug.
 */

/** "6 forks", and nothing at all where there are none. Their own row does the same. */
export const Count = ({
  many,
  one,
  href
}: {
  readonly many: number
  readonly one: string
  readonly href: string
}) =>
  many === 0 ? null : (
    <a href={href} className="text-xs text-ink-muted hover:underline">
      {many} {one}
      {many === 1 ? "" : "s"}
    </a>
  )

export type LabelAndNameProps = {
  readonly id: string
  /** GitHub's own name for the gist, shown as the placeholder a Name replaces. */
  readonly title: string
  readonly labels: ReadonlyArray<string>
  readonly name: string | null
  /** Every Label this reader has used before, offered rather than retyped. */
  readonly known: ReadonlyArray<string>
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
  readonly onClose: () => void
}

/**
 * The editor for the two fields GitHub has no field for.
 *
 * Labels are typed as a comma-separated line rather than added one chip at a time. It is
 * the shape a reader can retype from memory, paste, and correct without hunting for a
 * delete control on each chip — and `withLabels` already trims, drops the empties and
 * keeps one of each, so the sloppiness the format invites costs nothing.
 */
export const LabelAndName = ({
  id,
  title,
  labels,
  name,
  known,
  onChange,
  onClose
}: LabelAndNameProps) => {
  const [typed, setTyped] = useState(labels.join(", "))
  const [called, setCalled] = useState(name ?? "")

  const save = (): void => {
    onChange(
      id,
      typed
        .split(",")
        .map((one) => one.trim())
        .filter((one) => one.length > 0),
      called.trim().length === 0 ? null : called.trim()
    )
    onClose()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-line-muted pt-2">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Name
        <input
          value={called}
          onChange={(event) => setCalled(event.target.value)}
          placeholder={title}
          className="h-8 rounded-md bg-hover px-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Labels, separated by commas
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          list={`gist-labels-known-${id}`}
          className="h-8 rounded-md bg-hover px-2 text-sm"
        />
      </label>
      <datalist id={`gist-labels-known-${id}`}>
        {known.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="h-7 rounded-md bg-accent-emphasis px-3 text-xs text-ink-on-emphasis"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-7 rounded-md px-3 text-xs text-ink-muted hover:bg-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/** The Labels a gist carries, drawn where a reader can see them without opening anything. */
export const LabelChips = ({ labels }: { readonly labels: ReadonlyArray<string> }) =>
  labels.length === 0 ? null : (
    <div className="mt-2 flex flex-wrap gap-1">
      {labels.map((label) => (
        <span key={label} className="rounded-full bg-hover px-2 text-xs text-ink-muted">
          {label}
        </span>
      ))}
    </div>
  )
