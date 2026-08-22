import { Effect, Fiber, Option } from "effect"
import { onTheirShelves, queryFor, type RepoList } from "../domain/repoList"
import { keyOf } from "../domain/PullRequestRef"
import { type Branches, type Sitting, sittingsIn, worthAskingForBranches } from "../domain/sittings"
import {
  SHELVES,
  type InvolvedPullRequest,
  type Standings,
  withSizes,
  withStandings
} from "../domain/workingSet"
import { GitHubGateway, type Pages } from "../ports/GitHubGateway"
import { sizesOf } from "./sizes"

/**
 * How many branch reads run at once.
 *
 * Higher than the Working Set allows itself, and for a reason: every row of a
 * repository's page is in the same repository, so every one of them is a candidate
 * for a stack and all twenty-five get asked about. Four at a time would be six
 * rounds of a second each before the tree appeared.
 */
const BRANCHES_AT_ONCE = 8
const SEARCH_PAGES_AT_ONCE = 4
const MAX_SEARCH_PAGES = 40

const allPages = Effect.fn("repoList.allPages")(function* (list: RepoList) {
  const gateway = yield* GitHubGateway
  const first = yield* gateway.search(queryFor(list), 1)
  const total = Option.match(first.pages, {
    onNone: () => 1,
    onSome: (pages) => pages.total
  })
  const lastPage = Math.min(total, MAX_SEARCH_PAGES)
  const rest = yield* Effect.all(
    Array.from({ length: Math.max(0, lastPage - 1) }, (_, at) =>
      gateway.search(queryFor(list), at + 2)
    ),
    { concurrency: SEARCH_PAGES_AT_ONCE }
  )

  return {
    rows: [first, ...rest].flatMap((found) => found.rows),
    pages:
      total > MAX_SEARCH_PAGES
        ? Option.map(first.pages, (pages) => ({ ...pages, current: 1 }))
        : Option.none<Pages>()
  }
})

const branchesOf = Effect.fn("repoList.branchesOf")(function* (
  rows: ReadonlyArray<InvolvedPullRequest>
) {
  const gateway = yield* GitHubGateway

  const found = yield* Effect.all(
    worthAskingForBranches(rows).map((reference) =>
      gateway.branches(reference).pipe(
        Effect.orElseSucceed((): Option.Option<Branches> => Option.none()),
        Effect.map((branches) => [keyOf(reference), branches] as const)
      )
    ),
    { concurrency: BRANCHES_AT_ONCE }
  )

  return new Map(found)
})

/** A repository's pull requests, arranged into Courts, ready for the screen. */
export type Listed = {
  readonly sittings: ReadonlyArray<Sitting>
  readonly pages: Option.Option<Pages>
}

/**
 * Reads the parts of a repository's page that survive to the next page, and no more.
 *
 * The pointer's version of {@link loadRepoList}: the search that is the list, and the
 * shelves that say which rows are the reader's own. Not the standings and not the
 * branches, which are not kept and so cannot be read on the other side.
 */
export const warmRepoList = Effect.fn("warmRepoList")(function* (list: RepoList) {
  const gateway = yield* GitHubGateway

  yield* Effect.all(
    [
      Effect.asVoid(gateway.search(queryFor(list), list.page)),
      ...SHELVES.map((shelf) => Effect.asVoid(gateway.workingSet(shelf)))
    ],
    { concurrency: "unbounded" }
  )
})

/**
 * One cached page of a repository's list, without asking GitHub.
 *
 * Nothing without the page itself, which is the read that is the list. The
 * shelves are wanted but not required, exactly as they are in the live read
 * below: they only say which of these rows are the reader's own, and a page that
 * lost them shows every row as somebody else's — less useful, still true.
 *
 * The stacks, the sizes and the standings come with it, as they do for the Working
 * Set: each is a read per row, each is kept as it lands, and a page drawn without
 * them is a page that spends the next few seconds visibly assembling itself in
 * front of somebody who was looking at the finished thing a moment ago.
 *
 * The standings for the reason `rememberedWorkingSet` gives at length: the rollup
 * is not only drawn on the row, it is read by `courtOf`, so a page opened without
 * it sorts one way and re-sorts when the live read lands.
 */
export const rememberedRepoList = Effect.fn("rememberedRepoList")(function* (list: RepoList) {
  const gateway = yield* GitHubGateway

  const found = yield* gateway.rememberedSearch(queryFor(list), list.page)
  if (Option.isNone(found)) return Option.none<Listed>()

  const shelves = yield* Effect.all(SHELVES.map((shelf) => gateway.rememberedShelf(shelf)))
  const shelved = shelves.flatMap(Option.getOrElse((): ReadonlyArray<InvolvedPullRequest> => []))

  const rows = onTheirShelves(found.value.rows, shelved)
  const kept = yield* gateway.rememberedRows(rows)

  return Option.some({
    sittings: sittingsIn(withSizes(withStandings(rows, kept.standings), kept.sizes), (one) =>
      Option.fromNullishOr(kept.branches.get(keyOf(one.reference)))
    ),
    pages: found.value.pages
  })
})

/**
 * One repository's pull request list.
 *
 * Four reads, and as with the Working Set they fail differently on purpose.
 *
 * The search fails loudly. It is the page: without it there is nothing to show, and
 * a repository list that quietly showed nothing would read as a repository with no
 * open pull requests, which is a different and wrong answer.
 *
 * The shelves fail quietly, which is the difference from the Working Set. There they
 * *are* the page and a missing one hides work; here they only say which of these
 * rows are the reader's own. A page that lost them shows every row as somebody
 * else's — less useful, still true, and still the list the address asked for.
 *
 * The standings and the branches fail quietly for the reasons they always do: both
 * only ever add to a row already worth drawing, and None already means "not known".
 *
 * The four reads also finish minutes apart in a busy repository — the search in one
 * round trip, the branches in six — so each one is reported as it lands rather than
 * held back until the last. `partly` is handed the list as it stands after every
 * stage: the rows, then whose move each is, then the checks, then the stacks. A
 * caller with nowhere to put a half answer leaves it out and gets only the return.
 */
export const loadRepoList = Effect.fn("loadRepoList")(function* (
  list: RepoList,
  partly: (listed: Listed) => void = () => {}
) {
  const gateway = yield* GitHubGateway

  // Forked rather than awaited alongside the search, because the page and the
  // reader's involvement in it are independent reads: taking them in turn would cost
  // a round trip, and taking them together would hold the rows back until both land.
  const shelving = yield* Effect.forkChild(
    Effect.all(
      SHELVES.map((shelf) => gateway.workingSet(shelf)),
      { concurrency: "unbounded" }
    ).pipe(Effect.orElseSucceed((): ReadonlyArray<ReadonlyArray<InvolvedPullRequest>> => [])),
    // Away at once, rather than when this fiber next pauses: the point of forking it
    // is that the shelves and the page are in flight at the same moment.
    { startImmediately: true }
  )

  const found = yield* allPages(list)

  /*
   * What the store already knows about these rows, before the reads that find it
   * out have gone anywhere.
   *
   * Every stage below is drawn with it. Without that, a page opened from memory
   * complete — stacks folded, sizes on every row — went plain again the instant
   * this read's first stage landed, and stayed that way for the several seconds
   * the merge boxes take: the reader watched their own list get worse.
   */
  const kept = yield* gateway.rememberedRows(found.rows)
  const stackedAsKept = (one: InvolvedPullRequest) =>
    Option.fromNullishOr(kept.branches.get(keyOf(one.reference)))

  /** The list as it stands, with what is kept standing in for what is still coming. */
  const sofar = (rows: ReadonlyArray<InvolvedPullRequest>): Listed => ({
    sittings: sittingsIn(rows, stackedAsKept),
    pages: found.pages
  })

  // The kept sizes go on the rows themselves rather than into `sofar`, so that a
  // live size arriving later replaces one rather than being replaced by it.
  const measuredAsKept = withSizes(found.rows, kept.sizes)
  partly(sofar(measuredAsKept))

  const shelves = yield* Fiber.join(shelving)
  const rows = onTheirShelves(measuredAsKept, shelves.flat())
  partly(sofar(rows))

  const standings = yield* gateway
    .standingsFor(rows.map((one) => one.id))
    .pipe(Effect.orElseSucceed((): Standings => new Map()))

  const known = withStandings(rows, standings)
  partly(sofar(known))

  // Forked, and reported the moment it lands rather than at the end: the sizes
  // are a second of tiny requests and the branches are six rounds of whole merge
  // boxes, so holding one behind the other would cost the reader five seconds of
  // a column that was ready.
  const sizing = yield* Effect.forkChild(
    sizesOf(known).pipe(
      Effect.tap((sizes) => Effect.sync(() => partly(sofar(withSizes(known, sizes)))))
    ),
    { startImmediately: true }
  )

  const branches = yield* branchesOf(known)
  const measured = withSizes(known, yield* Fiber.join(sizing))

  return {
    sittings: sittingsIn(measured, (one) => {
      // The live answer where there is one, and what was kept where the read said
      // nothing: a payload that left the branches out is not a reason to forget a
      // stack that was on the screen a moment ago.
      const live = branches.get(keyOf(one.reference))
      return live !== undefined && Option.isSome(live) ? live : stackedAsKept(one)
    }),
    pages: found.pages
  }
})
