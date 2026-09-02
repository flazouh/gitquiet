import { useState } from "react"
import type { GistRow } from "../domain/gistList"
import { Count, LabelAndName, LabelChips } from "./GistMarks"

/**
 * One gist on a reader's own list.
 *
 * Everything their row prints, plus the two things this extension keeps that GitHub has
 * no field for: a Name over the ASCII-sorted filename GitHub picked, and Labels.
 */

export type GistRowViewProps = {
  readonly row: GistRow
  readonly labels: ReadonlyArray<string>
  readonly name: string | null
  /** Every Label this reader has used before, offered rather than retyped. */
  readonly known: ReadonlyArray<string>
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
}

export const GistRowView = ({ row, labels, name, known, onChange }: GistRowViewProps) => {
  const [open, setOpen] = useState(false)
  const at = `/${row.owner}/${row.id}`

  return (
    <div className="rounded-md bg-raised p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <a href={at} className="text-sm font-semibold hover:underline">
          {name ?? row.title}
        </a>
        {/*
          The name GitHub picked, kept visible beside the one the reader chose. A Name
          that replaced it outright would leave a reader unable to match this row against
          the same gist in GitHub's own list, or in a link somebody sent them.
        */}
        {name === null ? null : <span className="text-xs text-ink-muted">{row.title}</span>}
        {row.secret ? (
          <span
            title="Anyone with the link can see this gist. The link is the only thing keeping it out of a search engine."
            className="rounded-full bg-attention-muted px-2 text-xs text-ink"
          >
            Secret
          </span>
        ) : null}
      </div>

      {row.description === null ? null : (
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{row.description}</p>
      )}

      {/*
        The file content their list prints under every row, folded.

        Parity, and the reason it is folded rather than dropped: the oldest complaint in
        the whole survey is "browsing through 20 pages of 3-line excerpts", so a list
        that prints every excerpt at full height is the thing being complained about.
        But the excerpt is also what makes their list scannable when a filename does not
        say enough, and this screen's own search reads it — a reader who found a gist by
        a word in its content should be able to see the word.
      */}
      {row.preview === "" ? null : (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-ink-muted">Preview</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-inset p-2 text-xs whitespace-pre-wrap">
            {row.preview}
          </pre>
        </details>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Count many={row.files} one="file" href={at} />
        <Count many={row.forks} one="fork" href={`${at}/forks`} />
        <Count many={row.comments} one="comment" href={`${at}#comments`} />
        <Count many={row.stars} one="star" href={`${at}/stargazers`} />
        {row.updatedAt === "" ? null : (
          <span className="text-xs text-ink-muted">
            {new Date(row.updatedAt).toLocaleDateString()}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="text-xs text-ink-muted hover:underline"
        >
          Label / name…
        </button>
      </div>

      <LabelChips labels={labels} />

      {open ? (
        <LabelAndName
          id={row.id}
          title={row.title}
          labels={labels}
          name={name}
          known={known}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
