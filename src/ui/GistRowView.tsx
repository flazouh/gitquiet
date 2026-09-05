import { useState } from "react"
import type { GistRow } from "../domain/gistList"
import { LabelAndName } from "./GistMarks"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * One gist on a reader's own list, as a row of a table.
 *
 * The shape every other list here has: one grid per row, every row on the same tracks,
 * so the eye runs down a column rather than reading each card from its top left. It was
 * a card per gist before, forty pixels tall each, and forty of them was the wall of
 * three-line excerpts the oldest complaint in the survey is about.
 *
 * What their row prints is all still here — the counts, the Secret badge, the date — plus
 * the two things this extension keeps that GitHub has no field for: a Name over the
 * ASCII-sorted filename GitHub picked, and Labels.
 */

/**
 * Which columns the table draws, decided once from every row rather than per row.
 *
 * A count that is zero on every row is a column of nothing, and a column of nothing is
 * width taken from the titles beside it. Their own row prints "1 file" on nearly every
 * gist, which is the same fact as the row existing, so files are a column only where
 * some gist has more than one.
 *
 * The owner is a column only where the rows are not all one person's: a reader's own
 * list is theirs by definition, and the starred list is everybody else's.
 */
export type GistColumns = {
  readonly owner: boolean
  readonly files: boolean
  readonly comments: boolean
  readonly stars: boolean
  readonly forks: boolean
}

export const gistColumns = (rows: ReadonlyArray<GistRow>): GistColumns => ({
  owner: new Set(rows.map((row) => row.owner)).size > 1,
  files: rows.some((row) => row.files > 1),
  comments: rows.some((row) => row.comments > 0),
  stars: rows.some((row) => row.stars > 0),
  forks: rows.some((row) => row.forks > 0)
})

const TRACK = {
  face: "1rem",
  secret: "3.25rem",
  title: "minmax(160px,1fr)",
  description: "minmax(0,1.5fr)",
  count: "minmax(0,6rem)",
  age: "minmax(0,4.5rem)"
} as const

/** The grid every row of one table shares. */
export const tracksOf = (columns: GistColumns): string =>
  [
    ...(columns.owner ? [TRACK.face] : []),
    TRACK.secret,
    TRACK.title,
    TRACK.description,
    ...(columns.files ? [TRACK.count] : []),
    ...(columns.comments ? [TRACK.count] : []),
    ...(columns.stars ? [TRACK.count] : []),
    ...(columns.forks ? [TRACK.count] : []),
    TRACK.age
  ].join(" ")

/** "4 stars", or nothing at all on a row where there are none. Their own row does the same. */
const Tally = ({ many, one }: { readonly many: number; readonly one: string }) => (
  <span className="truncate text-right text-xs text-ink-muted tabular-nums">
    {many === 0 ? "" : `${many} ${one}${many === 1 ? "" : "s"}`}
  </span>
)

export type GistRowViewProps = {
  readonly row: GistRow
  readonly columns: GistColumns
  readonly labels: ReadonlyArray<string>
  readonly name: string | null
  /** Every Label this reader has used before, offered rather than retyped. */
  readonly known: ReadonlyArray<string>
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
}

export const GistRowView = ({ row, columns, labels, name, known, onChange }: GistRowViewProps) => {
  const [editing, setEditing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const at = `/${row.owner}/${row.id}`

  return (
    /*
     * A row is a link and, at its end, two buttons — and a button inside a link is
     * neither valid nor pressable without arguing with the link. So the row is a
     * wrapper: everything that is read, which is the link, and the things that act,
     * which are not. Hover lights the whole line.
     */
    <div
      data-row=""
      className="group grid items-center rounded-md pr-1 hover:bg-hover"
      style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
    >
      <a
        href={at}
        aria-label={`${name ?? row.title}${row.secret ? ". Secret" : ""}`}
        className="grid min-w-0 items-center gap-2 px-3 py-1.5 no-underline"
        style={{ gridTemplateColumns: tracksOf(columns) }}
      >
        {columns.owner ? <Who login={row.owner} /> : null}

        {/*
          Said in the row rather than in a tooltip, which is where GitHub keeps it.
          The word alone is enough here: what it means is said in full on the gist's
          own page, once, where the reader is looking at the thing it is about.
        */}
        <span>
          {row.secret ? (
            <span className="rounded-full bg-attention-muted px-2 text-xs text-ink">Secret</span>
          ) : null}
        </span>

        {/*
          The Name the reader chose, with the name GitHub picked kept beside it. A Name
          that replaced it outright would leave a reader unable to match this row against
          the same gist in GitHub's own list, or in a link somebody sent them.
        */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{name ?? row.title}</span>
          {name === null ? null : (
            <span className="truncate text-xs text-ink-muted">{row.title}</span>
          )}
          {labels.map((label) => (
            <span
              key={label}
              className="shrink-0 rounded-full bg-hover px-2 text-xs text-ink-muted"
            >
              {label}
            </span>
          ))}
        </span>

        <span className="truncate text-xs text-ink-muted">{row.description ?? ""}</span>

        {columns.files ? <Tally many={row.files} one="file" /> : null}
        {columns.comments ? <Tally many={row.comments} one="comment" /> : null}
        {columns.stars ? <Tally many={row.stars} one="star" /> : null}
        {columns.forks ? <Tally many={row.forks} one="fork" /> : null}

        <span
          className="truncate text-right text-xs text-ink-muted tabular-nums"
          title={row.updatedAt === "" ? undefined : momentOf(row.updatedAt)}
        >
          {row.updatedAt === "" ? "" : ageOf(row.updatedAt)}
        </span>
      </a>

      <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        {/*
          The file content their list prints under every row, folded. The oldest
          complaint in the survey is "browsing through 20 pages of 3-line excerpts", so
          a table that printed every excerpt would be the thing complained about — but
          this screen's search reads the excerpt, and a reader who found a gist by a word
          in its content should be able to see the word.
        */}
        {row.preview === "" ? null : (
          <button
            type="button"
            aria-expanded={previewing}
            onClick={() => setPreviewing((was) => !was)}
            className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-active hover:text-ink"
          >
            Preview
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing((was) => !was)}
          className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-active hover:text-ink"
        >
          Label / name…
        </button>
      </span>

      {previewing ? (
        <pre className="col-span-2 mx-3 mb-2 max-h-48 overflow-auto rounded-md bg-inset p-2 text-xs whitespace-pre-wrap">
          {row.preview}
        </pre>
      ) : null}

      {editing ? (
        <div className="col-span-2 mx-3 mb-2">
          <LabelAndName
            id={row.id}
            title={row.title}
            labels={labels}
            name={name}
            known={known}
            onChange={onChange}
            onClose={() => setEditing(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
