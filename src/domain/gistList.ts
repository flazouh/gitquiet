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
   * `research/gist-pain-points.md` in the notes repository — and it costs nothing extra to read, because
   * it is already in the document.
   */
  readonly preview: string
  readonly secret: boolean
  /** ISO 8601, off the `<relative-time>` element's own attribute. */
  readonly updatedAt: string
  /**
   * The four counts their own row prints, so a screen replacing that row prints them too.
   *
   * Parity rather than judgement. None of these is a fact this interface would choose to
   * show about a gist — nobody is deciding anything from a fork count — but a reader who
   * had them and now does not has been taken something, and a page that takes things
   * away is not the same page in a nicer font.
   */
  readonly files: number
  readonly forks: number
  readonly comments: number
  readonly stars: number
}

/**
 * Whether a Row answers a free-text search, over everything a reader might
 * remember about a gist they wrote: its name, its description, the content
 * GitHub already sent, and — through `extra` — whatever this extension has
 * kept about it that GitHub never carries, a Label or a Name.
 *
 * `extra` is a caller-built string rather than a `KeptGists` lookup, so this
 * stays a pure function of one Row and does not have to know the shape
 * `gistLabels.ts` keeps things in.
 *
 * An empty query matches everything, which is what lets Label filtering and
 * text search share one predicate rather than two.
 */
export const matchesQuery = (row: GistRow, query: string, extra: string = ""): boolean => {
  const asked = query.trim().toLowerCase()
  if (asked.length === 0) return true

  const haystack = [row.title, row.description ?? "", row.preview, extra].join(" ").toLowerCase()
  return haystack.includes(asked)
}

/**
 * Which gists a reader is looking at, which is GitHub's own "Type" filter.
 *
 * Their words, because this is parity: their dropdown says All, Public, Secret and a
 * reader who has used it should find it here saying the same three things.
 */
export type Kind = "all" | "public" | "secret"

export const isKind = (row: GistRow, kind: Kind): boolean =>
  kind === "all" || (kind === "secret" ? row.secret : !row.secret)

/**
 * How the list is ordered.
 *
 * GitHub offers two, "Recently created" and "Recently updated", and only one of them can
 * be honoured here: their row prints a single date, and which date it is depends on the
 * sort their page was already serving. Reading "Last active" and calling it a creation
 * date would be a list that silently reorders itself into a lie.
 *
 * So the created order is not offered, and four orders their page does not have are —
 * every one of them off a number their own row already prints. A reader who wanted
 * "which of these did anyone else ever care about" had no way to ask GitHub that, and
 * the sort is the cheapest possible answer to it.
 */
export type Order = "updated" | "title" | "stars" | "forks" | "comments"

const by = (order: Order) => (left: GistRow, right: GistRow): number => {
  switch (order) {
    case "updated":
      // Newest first, and an unreadable date sorts last rather than first: a row whose
      // `relative-time` could not be read is missing information, not brand new.
      return (right.updatedAt || "").localeCompare(left.updatedAt || "")
    case "title":
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    case "stars":
      return right.stars - left.stars
    case "forks":
      return right.forks - left.forks
    case "comments":
      return right.comments - left.comments
  }
}

/**
 * The list as the reader asked for it: their Type, their Labels, their words, their order.
 *
 * One function rather than four chained by the screen, because the order these are
 * applied in is a fact about the answer and not about the caller. Filtering after
 * sorting costs nothing and reads the same; filtering after *slicing* would quietly
 * drop matches, and a screen that grew a slice later is exactly where that creeps in.
 *
 * `labels` is every Label the row must carry, all of them rather than any: a reader who
 * has picked two Labels has narrowed, which is the only reading of two filters that is
 * ever useful.
 */
export const sifted = (
  rows: ReadonlyArray<GistRow>,
  asked: {
    readonly kind: Kind
    readonly order: Order
    readonly query: string
    readonly labels: ReadonlyArray<string>
  },
  extraFor: (row: GistRow) => string = () => "",
  labelsFor: (row: GistRow) => ReadonlyArray<string> = () => []
): ReadonlyArray<GistRow> =>
  rows
    .filter((row) => isKind(row, asked.kind))
    .filter((row) => {
      const carried = labelsFor(row)
      return asked.labels.every((wanted) => carried.includes(wanted))
    })
    .filter((row) => matchesQuery(row, asked.query, extraFor(row)))
    .toSorted(by(asked.order))
