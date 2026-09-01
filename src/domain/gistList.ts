/**
 * A reader's own gist list, in this codebase's words. See `docs/spec/gists.md`.
 */

/** One row of a reader's own gist list. */
export type GistRow = {
  readonly id: string
  readonly owner: string
  /** The gist's own name, which is GitHub's ASCII-sorted first filename — see `blame.md`'s cousin complaint about it. */
  readonly title: string
  readonly description: string | null
  /**
   * Every file's content GitHub already rendered into the row itself.
   *
   * Read live on 2026-09-02: the list page ships a preview of each gist's
   * files inline, the same markdown-body or code block the gist's own page
   * draws. This is what GitHub's own search does not read — confirmed in
   * `docs/gist-pain-points.md` — and it costs nothing extra to read, because
   * it is already in the document.
   */
  readonly preview: string
  readonly secret: boolean
  /** ISO 8601, off the `<relative-time>` element's own attribute. */
  readonly updatedAt: string
}

/**
 * Whether a Row answers a free-text search, over everything a reader might
 * remember about a gist they wrote: its name, its description, and the
 * content GitHub already sent.
 *
 * An empty query matches everything, which is what lets Label filtering and
 * text search share one predicate rather than two.
 */
export const matchesQuery = (row: GistRow, query: string): boolean => {
  const asked = query.trim().toLowerCase()
  if (asked.length === 0) return true

  const haystack = [row.title, row.description ?? "", row.preview].join(" ").toLowerCase()
  return haystack.includes(asked)
}
