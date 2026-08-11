import { Option } from "effect"
import type { Participant } from "./PullRequest"
import type { CheckRollup } from "./workingSet"

/**
 * A branch's commits — `/owner/repo/commits/BRANCH`.
 *
 * The history of one line of work, which is a different question from the one a
 * pull request's commits tab answers. That tab shows the commits a proposal
 * carries; this shows what has actually landed, in the order it landed, whether
 * anybody proposed it or not.
 */
export type CommitList = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * The branch the address named, or nothing where it named none.
   *
   * Nothing is not a missing answer: `/owner/repo/commits` is a page GitHub
   * serves, and it serves the repository's default branch. Which branch that is
   * belongs to the repository rather than to the address, so the address does
   * not guess at it.
   */
  readonly branch: Option.Option<string>
  /**
   * Whatever the address carried after the question mark, unread and unedited.
   *
   * Their pager writes its cursor here, and so do their author, since and until
   * filters. Kept verbatim for the same reason the repository list keeps its
   * query: the vocabulary is theirs, and a filter this does not know about is
   * still a filter the route understands.
   */
  readonly search: string
}

/**
 * Reads a branch's commits out of an address, or nothing where the address is
 * not one.
 *
 * Written against the whole URL rather than a pathname because it has to reject
 * other hosts: this runs on every page a content script is matched into.
 */
export const commitListIn = (url: string): Option.Option<CommitList> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  // Three segments or four, and no more. A fifth is a file's history —
  // `/commits/main/src/app.ts` — which is a page about one file rather than one
  // branch, and which this does not draw.
  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  if (segments.length < 3 || segments.length > 4) return Option.none()

  const [owner, repo, commits, branch] = segments
  if (commits !== "commits" || owner === undefined || repo === undefined) return Option.none()

  return Option.some({
    repo: { owner, repo },
    branch: Option.fromNullishOr(branch),
    search: address.searchParams.toString()
  })
}

/**
 * The route that reads one page of them, as their own page reads it.
 *
 * The search goes back exactly as it arrived. Their cursor is a sha and an
 * offset with a space between, which is what `URLSearchParams` writes as a plus
 * and reads back as a space — so it survives being taken apart and put together
 * again, and there is no cursor of theirs to parse.
 */
export const routeFor = ({ branch, search }: CommitList): string => {
  const path = Option.match(branch, {
    onNone: () => "/commits",
    onSome: (name) => `/commits/${encodeURIComponent(name)}`
  })

  return search === "" ? `${path}` : `${path}?${search}`
}

/**
 * The same page with a different cursor, as an address a link can carry.
 *
 * Both cursors are dropped before one is written, because a page is read in one
 * direction: keeping the old `before` while adding an `after` asks for two
 * places at once, and GitHub answers such an address with whichever it prefers.
 */
const movedTo = (list: CommitList, which: "after" | "before", cursor: string): string => {
  const search = new URLSearchParams(list.search)
  search.delete("after")
  search.delete("before")
  search.set(which, cursor)

  const { owner, repo } = list.repo
  return `/${owner}/${repo}${routeFor({ ...list, search: search.toString() })}`
}

/**
 * The same repository's commits, on another branch.
 *
 * The cursor goes, and so does everything else in the query. A place in one
 * branch's history means nothing in another's — their cursor is a sha and an
 * offset from it — and an author or a date filter carried across is a reader
 * arriving at a branch that looks empty for a reason nothing on the page says.
 */
export const atBranch = (list: CommitList, branch: string): string => {
  const { owner, repo } = list.repo
  return `/${owner}/${repo}${routeFor({ ...list, branch: Option.some(branch), search: "" })}`
}

/**
 * The same page, narrowed by one of their own filters, or with it taken off.
 *
 * The cursor goes with every change. It is a place in the list being replaced —
 * a sha and an offset from it — and carried across it asks for the thirty-fifth
 * commit of a list that no longer has one, which GitHub answers with a page that
 * looks empty for a reason nothing on the screen says.
 *
 * Everything else in the query stays, because the filters narrow together: a
 * reader who picks a person and then picks a month means both.
 */
const narrowed = (list: CommitList, key: string, value: Option.Option<string>): string => {
  const search = new URLSearchParams(list.search)
  search.delete("after")
  search.delete("before")

  Option.match(value, {
    onNone: () => search.delete(key),
    onSome: (said) => search.set(key, said)
  })

  const { owner, repo } = list.repo
  return `/${owner}/${repo}${routeFor({ ...list, search: search.toString() })}`
}

const asked = (list: CommitList, key: string): Option.Option<string> =>
  Option.fromNullishOr(new URLSearchParams(list.search).get(key))

/** The commits one person wrote, which is `author` in their vocabulary. */
export const byAuthor = (list: CommitList, login: Option.Option<string>): string =>
  narrowed(list, "author", login)

/** Who the address is narrowed to already, where it is narrowed to anybody. */
export const authorIn = (list: CommitList): Option.Option<string> => asked(list, "author")

/**
 * What landed on or after a date, which is `since` in their vocabulary.
 *
 * A date rather than a moment: `since=2026-07-01` is what their own picker
 * writes, and a time of day is not a thing anybody means when they ask what
 * happened last month.
 */
export const sinceWhen = (list: CommitList, day: Option.Option<string>): string =>
  narrowed(list, "since", day)

/** Which date the address starts at already, where it starts anywhere. */
export const sinceIn = (list: CommitList): Option.Option<string> => asked(list, "since")

/** Older commits, which is where their Next goes. */
export const pageAfter = (list: CommitList, cursor: string): string =>
  movedTo(list, "after", cursor)

/** Newer commits, back towards the top of the branch. */
export const pageBefore = (list: CommitList, cursor: string): string =>
  movedTo(list, "before", cursor)

/**
 * One commit that has landed on the branch.
 *
 * Beside `Commit`, which is the row a pull request's own list draws. That one
 * carries a single author's login because the pull request payload gives one.
 * This carries all of them, because a commit written by two people is what
 * every one of these has been since the machines started committing, and a row
 * that names one of the two names the wrong one half the time.
 */
export type Landed = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  /**
   * The rest of the message, already rendered by GitHub, where there is any.
   *
   * Kept as their HTML for the same reason a description is: reproducing their
   * markdown is a project, and they have done it.
   */
  readonly bodyHtml: Option.Option<string>
  readonly authors: ReadonlyArray<Participant>
  /**
   * Who committed it, where that is somebody other than whoever wrote it.
   *
   * None on the ordinary commit, which is the point: naming a committer on every
   * row would name `web-flow` on every squashed merge in the repository, which is
   * GitHub's own machine and tells the reader nothing. A rebase, a cherry-pick and
   * a patch applied on somebody's behalf are the cases where the two differ and
   * the difference is the fact.
   */
  readonly committer: Option.Option<Participant>
  /**
   * The pull request this landed as, where the message says so.
   *
   * Read out of the message rather than asked for, because GitHub does not send
   * it: their own row finds it the same way, in the `(#123)` their squash and
   * merge writes. A commit pushed straight to the branch has none, and that
   * absence is worth as much as the number.
   */
  readonly pullRequest: Option.Option<number>
  readonly createdAt: string
  /**
   * What the second read had to say about it.
   *
   * None until that read lands, which is a moment after the list is drawn. See
   * {@link Mark}: these are the facts GitHub itself defers, and deferring them
   * here too is what keeps a page of forty commits one round trip from readable.
   */
  readonly mark: Option.Option<Mark>
  /**
   * How much of the repository it moved, once somebody has looked at the row.
   *
   * None until then, and none is the ordinary state of most rows on the page.
   * See {@link Stat}: this one costs a request per commit, so it is asked for a
   * row at a time rather than for a page at a time.
   */
  readonly stat: Option.Option<Stat>
}

/**
 * The size of a commit: what it touched, and by how much.
 *
 * The fact their own list leaves out, and the one that separates a typo from a
 * rewrite before the diff is open. Three numbers rather than a rendered `+279
 * −28`, so that the row decides how to draw them.
 */
export type Stat = {
  readonly files: number
  readonly added: number
  readonly removed: number
}

/**
 * The facts GitHub holds back from its own commit list.
 *
 * Their page draws the rows, then asks a second route for these and fills them
 * in. It is not an optimisation they chose lightly: a check rollup is a query per
 * commit, and forty of those in front of the list would put a second on every
 * page. So the shape follows theirs, and so does the timing.
 */
export type Mark = {
  /**
   * How the whole run of checks stands, and their own sentence about it.
   *
   * The three states are the ones a row can draw, which is the same three the
   * Working Set narrowed to; `said` is GitHub's summary — "251 / 252 checks OK" —
   * carried verbatim, because counting it again here would be a second answer to
   * a question they have already answered.
   */
  readonly checks: Option.Option<{
    readonly state: CheckRollup["state"]
    readonly said: string
  }>
  /** Whether GitHub could verify the signature on it. */
  readonly verified: boolean
  /** How many comments were left on the commit itself, which is nearly always none. */
  readonly comments: number
}

/**
 * A day's worth of them, under the heading GitHub wrote.
 *
 * The heading is theirs verbatim rather than a date to format here, because it
 * is written in the reader's own time zone by the server that knows it, and a
 * date formatted from `authoredDate` in this process would disagree with it at
 * the edges of the day.
 */
export type Day = {
  readonly title: string
  readonly commits: ReadonlyArray<Landed>
}

/**
 * One page of a branch's history.
 *
 * The branch is the one GitHub resolved rather than the one the address named,
 * so a page reached as `/commits` says which branch it is showing.
 *
 * Both cursors are theirs to give: nothing here counts pages or knows how many
 * there are, because their paging is a place in a list rather than a number,
 * and a list that grows while it is read has no last page to count to.
 */
export type History = {
  readonly branch: string
  readonly days: ReadonlyArray<Day>
  /** Where the older ones start, where GitHub said there are older ones. */
  readonly older: Option.Option<string>
  /** Where the newer ones start, which only a second page has. */
  readonly newer: Option.Option<string>
  /**
   * Where the rest of what they know about these commits is, in their words.
   *
   * Carried verbatim like the two cursors above, and for the same reason: the
   * address is theirs, it is different on every page — it repeats the cursor —
   * and building a second copy of it here would be a guess at a route that is
   * only ever correct by coincidence.
   */
  readonly rest: Option.Option<string>
}

/** Every commit of a page, with the days flattened away, for counting and for keys. */
export const commitsOf = (history: History): ReadonlyArray<Landed> =>
  history.days.flatMap((day) => day.commits)

/** What the deferred read answered, by the commit it is about. */
export type Marks = ReadonlyMap<string, Mark>

/** What the sizes read answered, by the commit it is about. */
export type Stats = ReadonlyMap<string, Stat>

/**
 * The same page with sizes folded into the commits that have one.
 *
 * Beside {@link withMarks} and for the same reason: a commit nobody has asked
 * about keeps its absent size rather than gaining a zero, because "not counted
 * yet" and "changed nothing" are different sentences and only one of them is
 * ever true of a real commit.
 */
export const withStats = (history: History, stats: Stats): History => ({
  ...history,
  days: history.days.map((day) => ({
    ...day,
    commits: day.commits.map((commit) => {
      const stat = stats.get(commit.sha)
      return stat === undefined ? commit : { ...commit, stat: Option.some(stat) }
    })
  }))
})

/**
 * The same page with the second read's answers folded into it.
 *
 * A commit the deferred read said nothing about keeps its absent mark rather
 * than gaining an empty one: "GitHub has not answered yet" and "GitHub says
 * there are no checks" are different sentences, and a row that draws the second
 * for the first is a row claiming a green branch is untested.
 */
export const withMarks = (history: History, marks: Marks): History => ({
  ...history,
  days: history.days.map((day) => ({
    ...day,
    commits: day.commits.map((commit) => {
      const mark = marks.get(commit.sha)
      return mark === undefined ? commit : { ...commit, mark: Option.some(mark) }
    })
  }))
})

/**
 * The pull request a commit landed as, out of the message GitHub wrote for it.
 *
 * Their squash writes `(#123)` at the end of the headline and their merge writes
 * `Merge pull request #123 from …` at the start of it. Anchored to those two
 * shapes rather than looking anywhere for a hash and a number, because a commit
 * whose subject mentions issue #7 did not land as pull request 7.
 */
export const proposalIn = (headline: string): Option.Option<number> => {
  const said = /\(#(\d+)\)\s*$/.exec(headline) ?? /^Merge pull request #(\d+)\b/.exec(headline)
  if (said === null || said[1] === undefined) return Option.none()

  return Option.some(Number(said[1]))
}
