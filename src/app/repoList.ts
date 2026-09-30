import { Effect, Fiber, Option } from "effect"
import { onTheirShelves, queryFor, type RepoList, shelvedAhead } from "../domain/repoList"
import { keyOf } from "../domain/PullRequestRef"
import { type Branches, type Sitting, sittingsIn, worthAskingForBranches } from "../domain/sittings"
import {
  SHELVES,
  type InvolvedPullRequest,
  type Standings,
  withSizes,
  withStandings
} from "../domain/workingSet"
import {
  type Found,
  GitHubGateway,
  type Pages,
  WorkingSetError
} from "../ports/GitHubGateway"
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
/**
 * How many pages of a search are worth reading, which is also all there are.
 *
 * Forty was chosen here as a thousand rows nobody scrolls. It is also, by
 * coincidence, exactly where GitHub's search stops: it serves no result past the
 * thousandth and reports no more than forty pages, whatever the repository
 * holds. So this is never *less* than what is on offer, and any rule that asks
 * whether the pages exceed it is a rule that cannot come out true — see the
 * note on `pages` below, which is where that went wrong.
 */
const MAX_SEARCH_PAGES = 40

/**
 * How many times an empty first page is asked again, and how long between.
 *
 * GitHub's dashboard search — `/pulls?q=repo:owner/name is:pr is:open`, the route
 * behind this list — is eventually consistent, and answers a question it cannot
 * yet serve with an ordinary two-hundred and no rows. A repository with ten open
 * pull requests comes back with none, its own `totalCount` sometimes still on the
 * page beside the empty `results` and sometimes zeroed with them. The list drew
 * that as "Nothing needs you", which is what a reader saw the morning they went
 * into a pull request and pressed Back onto a list that was full a second before.
 * Proved by serving one such answer to the built extension: the list emptied, and
 * the next plain reload filled it again.
 *
 * So an empty first page is asked again, a few hundred milliseconds later, a
 * bounded number of times. The wait is short because the reader is watching an
 * empty list until it answers, and the count is small because a repository that
 * genuinely has no open pull requests pays this on every visit — three reads and
 * half a second where there is nothing to find. Only the first page: a later page
 * coming back empty is the end of the list, not a glitch.
 *
 * This does not remove the empty state, it makes it mean something. A list still
 * empty after the last ask is a list GitHub keeps calling empty, and a reader can
 * still reload past a transient this did not outlast.
 */
const SETTLE_EMPTY_SEARCH = 2

/**
 * How long the first page waits for the reader's shelves before it is drawn without them.
 *
 * The shelves decide Needs You, and they usually land just behind the first page:
 * two tenths of a second on `openrouter-web`. Drawn without them, the page grew a
 * Needs You that much later and pushed every row down under a reader who had just
 * started on them. Short, because a reader waiting on slow shelves is a reader
 * looking at nothing: past this the page is drawn and the shelves join it after.
 */
const SHELVES_WAIT = "400 millis"
const EMPTY_SEARCH_WAIT = "300 millis"

/**
 * Whether what is in hand is all there is, decided by the rows rather than by the
 * page numbers.
 *
 * GitHub's search never serves past a thousand results, so it never reports more
 * than forty pages, and `total > MAX_SEARCH_PAGES` is a comparison that cannot come
 * out true. A repository with 2,795 open pull requests read the forty pages it is
 * allowed, held a thousand rows, and then said "1000 pull requests" — the cap drawn
 * as though it were the repository. Measured on `openrouter-web`, where the count
 * flickered to the true 2,795 while the first page was up and fell back to the cap
 * once the read finished.
 *
 * The count beside the pages is the repository's own and is not capped, so the
 * honest test is whether it is larger than what was actually read.
 */
const pagesBeyond = (first: Found, rows: number): Option.Option<Pages> =>
  Option.flatMap(first.pages, (pages) =>
    pages.count > rows ? Option.some<Pages>({ ...pages, current: 1 }) : Option.none<Pages>()
  )

/** The rows read so far, and whether the pages behind them are still coming. */
type Paged = {
  readonly rows: ReadonlyArray<InvolvedPullRequest>
  readonly pages: Option.Option<Pages>
  readonly paging: boolean
}

const allPages = Effect.fn("repoList.allPages")(function* (
  list: RepoList,
  /**
   * The list each time it grows, rather than once the last page lands.
   *
   * `MAX_SEARCH_PAGES` is forty at four at a time: ten rounds of a second each on a
   * repository with a thousand open pull requests. Everything used to wait on all of
   * them, and then only on the first: measured on `openrouter-web`, twenty-five rows
   * sat under a count of "25 of 2,834" for eight seconds with nothing to say more
   * was coming, and then the list jumped to a thousand at once.
   *
   * Handed over in page order, so a page that lands early waits for the ones above
   * it. The list only ever grows at the bottom, which is where a reader is not.
   */
  grew: (paged: Paged) => Effect.Effect<void> = () => Effect.void
) {
  const gateway = yield* GitHubGateway

  // The first page, asked again while it comes back empty. See the note above the
  // constants: an empty answer here is as often GitHub not ready as it is a
  // repository with nothing in it, and the two are told apart by asking once more.
  const firstPage = (left: number): Effect.Effect<Found, WorkingSetError> =>
    gateway.search(queryFor(list), 1).pipe(
      Effect.flatMap((found) =>
        found.rows.length > 0 || left === 0
          ? Effect.succeed(found)
          : Effect.sleep(EMPTY_SEARCH_WAIT).pipe(Effect.flatMap(() => firstPage(left - 1)))
      )
    )

  const first = yield* firstPage(SETTLE_EMPTY_SEARCH)

  const total = Option.match(first.pages, {
    onNone: () => 1,
    onSome: (pages) => pages.total
  })
  const behind: Array<Found | undefined> = Array.from({
    length: Math.max(0, Math.min(total, MAX_SEARCH_PAGES) - 1)
  })
  /** How many of the pages behind the first are in hand with every page above them. */
  let upTo = 0
  const sofar = (): Paged => {
    const rows = [first, ...behind.slice(0, upTo)].flatMap((found) => found?.rows ?? [])
    return { rows, pages: pagesBeyond(first, rows.length), paging: upTo < behind.length }
  }

  yield* grew(sofar())

  yield* Effect.all(
    behind.map((_, at) =>
      gateway.search(queryFor(list), at + 2).pipe(
        Effect.flatMap((found) => {
          behind[at] = found
          const was = upTo
          while (upTo < behind.length && behind[upTo] !== undefined) upTo += 1
          return upTo === was ? Effect.void : grew(sofar())
        })
      )
    ),
    { concurrency: SEARCH_PAGES_AT_ONCE, discard: true }
  )

  return sofar()
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
  /**
   * Whether more of the list is on its way, so the count can say it is not the answer yet.
   *
   * True on a page drawn from memory too: the live read is always behind it.
   */
  readonly paging: boolean
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
    pages: found.value.pages,
    paging: true
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

  /**
   * Which shelf each row was on when this reader last looked.
   *
   * A row's court comes from its shelf — `courtOfOne` reads it — and the shelf
   * is a separate read that lands after the rows do. So a row drawn before it
   * lands is a row filed under the wrong heading, and the moment the shelves
   * arrive every one of them moves. A list that regroups itself under a reader
   * who has started reading it is worse than a list that took another moment.
   *
   * `rememberedRepoList` never had this problem: it reads the remembered
   * shelves and files the rows before it hands any of them over. This is that,
   * for the live read — the same store, the same call, a few milliseconds, and
   * the rows land in the courts they will still be in when the live shelves
   * confirm them.
   *
   * Empty on a reader's first visit to a repository, and then the rows are
   * filed once the shelves arrive — which is why the shelves are put on the
   * list the moment they land rather than once the paging is over.
   */
  let shelved = yield* Effect.all(SHELVES.map((shelf) => gateway.rememberedShelf(shelf))).pipe(
    Effect.map((shelves) =>
      shelves.flatMap(Option.getOrElse((): ReadonlyArray<InvolvedPullRequest> => []))
    ),
    Effect.orElseSucceed((): ReadonlyArray<InvolvedPullRequest> => [])
  )
  /** The checks and reviews asked for before the pages behind them land. */
  let early: Standings = new Map()
  let paged: Paged | undefined
  /** Which draw is the latest, so a slow one cannot land over a newer list. */
  let drawn = 0

  /*
   * The list as it stands, whichever read moved it.
   *
   * Three reads move it while the pages are still arriving — the pages, the shelves,
   * the first page's checks — and they land in any order. Measured on `openrouter-web`
   * before this: the shelves were in hand within a second and were put on the list
   * after the fortieth page, nine seconds in, so Needs You arrived last and pushed a
   * thousand rows down under the reader.
   *
   * With what the store remembers standing in for what is still coming, and never at
   * the cost of the read: a store that will not answer is not a reason to hold the
   * list back.
   */
  const draw = Effect.suspend(() => {
    if (paged === undefined) return Effect.void
    const now = paged
    const mine = ++drawn
    const read = [...now.rows, ...shelvedAhead(list, now.rows, shelved)]
    return gateway.rememberedRows(read).pipe(
      Effect.map((kept) => {
        if (mine !== drawn) return
        // The checks kept from the last visit until this read's own land: they decide
        // Needs You, and without them a row filed there moved in a moment later.
        const standings = new Map([...kept.standings, ...early])
        const rows = withStandings(onTheirShelves(withSizes(read, kept.sizes), shelved), standings)
        partly({
          sittings: sittingsIn(rows, (one) =>
            Option.fromNullishOr(kept.branches.get(keyOf(one.reference)))
          ),
          pages: now.pages,
          paging: now.paging
        })
      }),
      Effect.catch(() => Effect.void)
    )
  })

  /** Checks and reviews as they land, added to what is already known rather than replacing it. */
  const standingsOf = (rows: ReadonlyArray<InvolvedPullRequest>) =>
    gateway.standingsFor(rows.map((one) => one.id)).pipe(
      Effect.flatMap((standings) => {
        early = new Map([...early, ...standings])
        return draw
      }),
      Effect.catch(() => Effect.void)
    )

  // The reader's own rows the pages have not reached get their checks as soon as they
  // are known to be here: a failing check is what files one under Needs You.
  const shelvesOn = yield* Effect.forkChild(
    Fiber.join(shelving).pipe(
      Effect.flatMap((shelves) => {
        shelved = shelves.flat()
        const ahead = shelvedAhead(list, paged?.rows ?? [], shelved)
        return ahead.length === 0 ? draw : Effect.andThen(draw, standingsOf(ahead))
      })
    ),
    { startImmediately: true }
  )
  let standingsOn: Fiber.Fiber<void> | undefined

  const found = yield* allPages(list, (next) =>
    Effect.gen(function* () {
      const first = paged === undefined
      if (first) {
        // Put on here rather than left to the watcher above, which may wake after this.
        const landed = yield* Effect.timeoutOption(Fiber.join(shelving), SHELVES_WAIT)
        if (Option.isSome(landed)) shelved = landed.value.flat()
      }
      paged = next
      yield* draw
      // The first page's checks, while the rest of it is read. They are what files a
      // row under Needs You, and on one page the full read below is the same request.
      if (first && next.paging) {
        standingsOn = yield* Effect.forkChild(standingsOf(next.rows), { startImmediately: true })
      }
    })
  )

  // Both early reads are settled before the stages below, which each draw a later list.
  yield* Fiber.join(shelvesOn)
  if (standingsOn !== undefined) yield* Fiber.join(standingsOn)

  /*
   * What the store already knows about these rows, before the reads that find it
   * out have gone anywhere.
   *
   * Every stage below is drawn with it. Without that, a page opened from memory
   * complete — stacks folded, sizes on every row — went plain again the instant
   * this read's first stage landed, and stayed that way for the several seconds
   * the merge boxes take: the reader watched their own list get worse.
   */
  const every = [...found.rows, ...shelvedAhead(list, found.rows, shelved)]
  const kept = yield* gateway.rememberedRows(every)
  const stackedAsKept = (one: InvolvedPullRequest) =>
    Option.fromNullishOr(kept.branches.get(keyOf(one.reference)))

  /** The list as it stands, with what is kept standing in for what is still coming. */
  const sofar = (rows: ReadonlyArray<InvolvedPullRequest>): Listed => ({
    sittings: sittingsIn(rows, stackedAsKept),
    pages: found.pages,
    paging: false
  })

  // The kept sizes go on the rows themselves rather than into `sofar`, so that a
  // live size arriving later replaces one rather than being replaced by it.
  const rows = onTheirShelves(withSizes(every, kept.sizes), shelved)

  // Over what the early reads found rather than instead of it: a row this answer leaves
  // out keeps the checks it was already drawn with.
  const standings = yield* gateway.standingsFor(rows.map((one) => one.id)).pipe(
    Effect.map((all): Standings => new Map([...early, ...all])),
    Effect.orElseSucceed((): Standings => early)
  )

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
    pages: found.pages,
    paging: false
  }
})
