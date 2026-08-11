import { Option } from "effect"
import { type ReactNode, useMemo, useState } from "react"
import type { ListedIssues } from "../app/issueList"
import { pageOf } from "../domain/issues"
import { answersIssue, sieveOf } from "../domain/sieve"
import { Filters } from "./Filters"
import { loginOnPage } from "./viewer"
import { columnsForIssues, IssueRow } from "./WorkingSet"

/**
 * One page of issues, filtered, counted and paged.
 *
 * The body both issue lists draw: a repository's own at `/owner/repo/issues`
 * and the reader's own at `/issues`. Everything above it differs — one names a
 * repository in the bar, the other carries GitHub's three tabs — and everything
 * from the filter row down is the same list of the same rows, so it is written
 * once here rather than twice and left to drift.
 *
 * Flat, on both pages. Home files issues into Courts because it asked three
 * questions that each name the reader; a repository's list asked one that names
 * a repository, and a tab of the reader's own has the question written on the
 * tab. Neither has a grouping left to draw that the page does not already say.
 */
export const IssueList = ({
  listed,
  what,
  within,
  nothing,
  seed = "",
  onPage
}: {
  readonly listed: ListedIssues
  /** What this list is, which the filter box says in its label. */
  readonly what: string
  /**
   * What the address already asked for, where it asked for anything.
   *
   * A reader can arrive here on a link to closed issues, or from GitHub's own
   * controls before this interface took the page. The rows are narrowed either
   * way; without this the box is empty and the page reads as everything there
   * is.
   */
  readonly seed?: string
  /**
   * The repository every row is in, where they are all in one.
   *
   * Given on a repository's own page, so no row repeats a name the bar already
   * carries. Absent on the reader's own list, where the rows come from
   * everywhere and the repository is the first thing worth knowing.
   */
  readonly within?: { readonly owner: string; readonly repo: string }
  /** What to say where GitHub answered with no issues at all. */
  readonly nothing: ReactNode
  readonly onPage: (page: number) => void
}) => {
  /*
   * Seeded in the first render rather than after it. A filter arriving a moment
   * later would draw the whole list and then take most of it away, which reads
   * as the page changing its mind about what was asked.
   */
  const [query, setQuery] = useState(seed)

  const rows = listed.rows

  const viewer = useMemo(() => loginOnPage() ?? undefined, [])
  const sieve = useMemo(() => sieveOf(query, viewer), [query, viewer])
  const shown = useMemo(() => rows.filter((one) => answersIssue(one, sieve)), [rows, sieve])

  /*
   * Worked out from the whole page rather than from the rows the filter left,
   * so that narrowing the list to three does not re-cut its columns while the
   * reader is still typing.
   */
  const columns = useMemo(() => columnsForIssues(rows, within), [rows, within])

  /** The people whose issues are on the screen, which is what the Author chip offers. */
  const authors = useMemo(() => [...new Set(rows.map((one) => one.author.login))].sort(), [rows])

  /** Whether there are more of these than the page the reader is looking at. */
  const paged = Option.match(listed.pages, {
    onNone: () => false,
    onSome: (where) => where.total > 1
  })

  /*
   * Whether the card's header is drawn at all, rather than drawn empty. It holds
   * two things and a repository's list on one page has neither: no page to name,
   * and the reader's own list at `/issues` is not in a repository to raise one in.
   */
  const heading = paged || within !== undefined

  return (
    <>
      <Filters
        query={query}
        authors={authors}
        viewer={viewer}
        what={what}
        about="issues"
        onQuery={setQuery}
      />

      {/*
       * One card holding the whole list, which is what a page with no Courts
       * is. Its header carries the way to raise one and, where there is more
       * than a page of them, which page this is: the bar above already says
       * where this list is from, and a heading here would be the same words a
       * third time.
       *
       * The card's own classes rather than `Section`, which is a titled box by
       * definition — a Section named "Issues" on the Issues tab is a label for
       * a thing nobody could mistake.
       */}
      <section
        aria-label={`Issues in ${what}`}
        className="shrink-0 overflow-hidden rounded-md border border-line bg-canvas"
      >
        {heading ? (
          <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
            <Tally pages={listed.pages} />
            {within === undefined ? null : <Raise within={within} />}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="px-3 py-2 text-sm text-ink-muted">{nothing}</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-ink-muted">Nothing matches that.</p>
        ) : (
          <div className="divide-y divide-line-muted">
            {shown.map((one) => (
              <IssueRow
                key={pageOf(one.reference)}
                one={one}
                chosen={false}
                arriving={NEVER}
                within={within}
                columns={columns}
              />
            ))}
          </div>
        )}
      </section>

      <Pager pages={listed.pages} onPage={onPage} />
    </>
  )
}

/**
 * How many there are, where the reader cannot see for themselves.
 *
 * Which is only ever on a list too long for one page. A repository with three
 * hundred issues open shows ten, and "300 issues · page 1 of 30" is the whole
 * of what the rows leave unsaid — but a repository with three shows three, and
 * "3 issues" over three rows is a number restating what is already on the
 * screen. It said that for a while, and it was worse than nothing: a filter
 * narrowing the list leaves the count at what GitHub answered, so three rows
 * could sit under the word twelve.
 */
const Tally = ({ pages }: { readonly pages: ListedIssues["pages"] }) =>
  Option.match(pages, {
    onNone: () => null,
    onSome: (where) =>
      where.total <= 1 ? null : (
        <span className="text-sm text-ink-muted">
          {where.count.toLocaleString()} {where.count === 1 ? "issue" : "issues"} · page{" "}
          {where.current} of {where.total}
        </span>
      )
  })

/**
 * The way to raise one, which is the only thing this page does rather than shows.
 *
 * An anchor rather than a button, because it is a navigation: the shell answers
 * every press inside our own root — see `going.ts` — so this gets the gate, the
 * screen fetched while the button is still down, and an address pushed without a
 * document load. A button calling `assign` would give up all three, and it could
 * not be opened in a new tab.
 *
 * Drawn only where the rows are all in one repository. The reader's own list at
 * `/issues` has no repository to raise an issue in, and GitHub's answer there is
 * a picker, which is a second press this interface has nothing to add to.
 */
const Raise = ({ within }: { readonly within: { readonly owner: string; readonly repo: string } }) => (
  <a
    href={`/${within.owner}/${within.repo}/issues/new`}
    className="ml-auto rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis hover:opacity-90"
  >
    New issue
  </a>
)

/**
 * The way to the rest of them.
 *
 * Two buttons rather than a row of numbered pages, for the reason a
 * repository's pull request list gives: the filter above the rows answers most
 * of what somebody would page around looking for.
 */
const Pager = ({
  pages,
  onPage
}: {
  readonly pages: ListedIssues["pages"]
  readonly onPage: (page: number) => void
}) =>
  Option.match(pages, {
    onNone: () => null,
    onSome: (where) =>
      where.total <= 1 ? null : (
        <div className="flex items-center justify-center gap-2 py-3">
          <button
            type="button"
            className="btn btn-sm"
            disabled={where.current <= 1}
            onClick={() => onPage(where.current - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={where.current >= where.total}
            onClick={() => onPage(where.current + 1)}
          >
            Next
          </button>
        </div>
      )
  })

/**
 * No stagger.
 *
 * The Working Set deals its rows in because they arrive in four waves over
 * several seconds and a list that changed silently underneath the reader was
 * the complaint. These pages have one read: every row lands in the same frame,
 * so an animation here would be ten rows pretending to arrive separately.
 */
const NEVER = (): number | undefined => undefined
