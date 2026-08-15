import { Effect, Option } from "effect"
import { INVOLVEMENTS, type InvolvedIssue } from "../domain/issues"
import { keyOf } from "../domain/PullRequestRef"
import { type Branches, type Sitting, sittingsIn, worthAskingForBranches } from "../domain/sittings"
import {
  SHELVES,
  type InvolvedPullRequest,
  type Standings,
  withSizes,
  withStandings
} from "../domain/workingSet"
import { GitHubGateway } from "../ports/GitHubGateway"
import { sizesOf } from "./sizes"

/**
 * How many branch reads run at once.
 *
 * Each is a whole `merge_box` for one pull request, asked only where a stack
 * could exist, and a Working Set spanning several busy repositories can want a
 * dozen. Four at a time keeps the list appearing quickly without opening a dozen
 * connections to GitHub on the reader's session for something the page is
 * perfectly readable without.
 */
const BRANCHES_AT_ONCE = 4

/**
 * The branches of the pull requests that could be stacked, as far as they can be
 * found out.
 *
 * A read that fails is a pull request with no branches, which `sittingsIn` draws
 * as a flat row. That is the honest degradation: the type already says branches
 * may be absent, and a stack nobody could confirm drawn as separate rows is a
 * smaller lie than a stack invented from a failed read.
 */
const branchesOf = Effect.fn("branchesOf")(function* (
  involved: ReadonlyArray<InvolvedPullRequest>
) {
  const gateway = yield* GitHubGateway

  const found = yield* Effect.all(
    worthAskingForBranches(involved).map((reference) =>
      gateway.branches(reference).pipe(
        Effect.orElseSucceed((): Option.Option<Branches> => Option.none()),
        Effect.map((branches) => [keyOf(reference), branches] as const)
      )
    ),
    { concurrency: BRANCHES_AT_ONCE }
  )

  return new Map(found)
})

/**
 * The issues the reader is involved in, or none of them.
 *
 * The one read on this page that is allowed to come back empty without emptying the page.
 * The shelves fail together because a Working Set missing pull requests cannot be told from
 * a complete one; issues are additive — a Court holding pull requests and no issues is the
 * page as it was last month, and it is worth more than nothing at all while their search is
 * having a bad afternoon.
 *
 * Three involvements at once, because each is its own query and the reason a reader is
 * involved is the whole of what decides the Court.
 */
const involvedIssues = Effect.fn("involvedIssues")(function* () {
  const gateway = yield* GitHubGateway

  const found = yield* Effect.all(
    INVOLVEMENTS.map((involvement) =>
      gateway
        .involvedIssues(involvement)
        .pipe(Effect.orElseSucceed((): ReadonlyArray<InvolvedIssue> => []))
    ),
    { concurrency: "unbounded" }
  )

  return found.flat()
})

/**
 * The whole Working Set, arranged into Courts, ready for the screen.
 *
 * Three reads deep, and they fail differently on purpose.
 *
 * The six shelves fail together. A shelf that did not answer is a Working Set
 * missing whole pull requests, and a list of pull requests missing some looks
 * exactly like a list of pull requests — the reader has no way to tell, and this
 * page is read to decide what to work on next. So nothing is shown rather than
 * part of it, which is the same stance the pull request card takes.
 *
 * The standings and the branches fail quietly. Both only ever add to a row that
 * is already real and worth drawing, both are already Options on the domain
 * type, and None already means "not known" rather than "none". A reader whose
 * check rollups did not arrive sees rows without check counts, which is what
 * they saw for the first moment anyway.
 */
/**
 * Reads the parts of the Working Set that survive to the next page, and no more.
 *
 * For a pointer resting on a link to the dashboard. Only the six shelves are kept
 * between visits, so only the six shelves are worth asking for: the standings and
 * the branches would be another dozen requests that nothing on the other side can
 * read, made on the reader's own session, for a page they may not even open.
 */
export const warmWorkingSet = Effect.fn("warmWorkingSet")(function* () {
  const gateway = yield* GitHubGateway

  yield* Effect.all(
    SHELVES.map((shelf) => gateway.workingSet(shelf)),
    { concurrency: "unbounded" }
  )
})

/**
 * The Working Set as it was the last time it was read, without asking GitHub
 * anything.
 *
 * What goes on the screen while {@link loadWorkingSet} finds out what is
 * actually there — the list's half of `rememberedPullRequest`, and it answers in
 * about as long as a storage read takes.
 *
 * Nothing unless all six shelves are on hand. A Working Set missing one is a
 * list of pull requests missing some, which looks exactly like a list of pull
 * requests: the reader cannot tell that the one they should be looking at is
 * the one that is not there. That is the same stance the live read takes, for
 * the same reason.
 *
 * The stacks, the sizes and the standings come with it, which is the difference
 * between the list that was there a moment ago and a paler copy of it: each is a
 * read per row and several seconds for a page, so a list drawn without them is a
 * list that visibly assembles itself while the reader waits. Each is kept as it
 * lands and is replaced by the live read a second or two later.
 *
 * The standings were held out of that for a while, on the grounds that a check
 * rollup from half an hour ago is drawn identically to one from a second ago. That
 * weighed only what the rollup looks like, and the rollup is also read: `courtOf`
 * puts a green pull request nobody is required to review under Needs You and the
 * same row without a rollup under Waiting. So the list opened in one order and the
 * live read re-sorted it two seconds later, rows crossing between headings while
 * the reader was already reading them. A rollup a minute old, under a toast saying
 * the list is being checked, is the smaller of the two lies.
 */
export const rememberedWorkingSet = Effect.fn("rememberedWorkingSet")(function* () {
  const gateway = yield* GitHubGateway

  const shelves = yield* Effect.all(SHELVES.map((shelf) => gateway.rememberedShelf(shelf)))
  if (shelves.some(Option.isNone)) return Option.none<ReadonlyArray<Sitting>>()

  const involved = shelves.flatMap(Option.getOrElse((): ReadonlyArray<InvolvedPullRequest> => []))
  const kept = yield* gateway.rememberedRows(involved)

  // The issues that were on hand, and no waiting for the ones that were not: this whole
  // read exists to put something on the screen in the time a storage read takes.
  const remembered = yield* Effect.all(
    INVOLVEMENTS.map((involvement) => gateway.rememberedInvolvedIssues(involvement))
  )

  return Option.some(
    sittingsIn(
      withSizes(withStandings(involved, kept.standings), kept.sizes),
      (one) => Option.fromNullishOr(kept.branches.get(keyOf(one.reference))),
      remembered.flatMap(Option.getOrElse((): ReadonlyArray<InvolvedIssue> => []))
    )
  )
})

export const loadWorkingSet = Effect.fn("loadWorkingSet")(function* () {
  const gateway = yield* GitHubGateway

  // At once, which is what GitHub's own dashboard does: six independent reads
  // taken one after another would be six round trips of the reader's time. The
  // issues go in the same breath for the same reason — waiting for the shelves
  // first would put the issues on the page a second after everything else.
  const [shelves, issues] = yield* Effect.all(
    [
      Effect.all(
        SHELVES.map((shelf) => gateway.workingSet(shelf)),
        { concurrency: "unbounded" }
      ),
      involvedIssues()
    ],
    { concurrency: 2 }
  )

  // Duplicates across shelves are left in. `sittingsIn` keeps one row per pull
  // request and keeps the shelf that puts it in more urgent company, which is a
  // decision about Courts and belongs where the Courts are decided.
  const involved = shelves.flat()

  /*
   * What the store already knows about these rows, before the reads that find it
   * out have gone anywhere.
   *
   * The dashboard opened from memory is complete — stacks folded and every row
   * measured — and this read takes several seconds to say either. Standing the kept
   * facts under it means the list stays as the reader left it while GitHub is asked,
   * rather than losing them and getting them back.
   */
  const kept = yield* gateway.rememberedRows(involved)

  const standings = yield* gateway
    .standingsFor(involved.map((one) => one.id))
    .pipe(Effect.orElseSucceed((): Standings => new Map()))

  const known = withSizes(withStandings(involved, standings), kept.sizes)

  // Together, because they are independent reads of different routes and the
  // sizes are the cheap one: taken in turn they would wait out six rounds of
  // merge boxes to spend a second on twenty-five requests of seventy bytes.
  const [branches, sizes] = yield* Effect.all([branchesOf(known), sizesOf(known)], {
    concurrency: 2
  })

  return sittingsIn(
    withSizes(known, sizes),
    (one) => {
      // The live answer where there is one, and what was kept where the read said
      // nothing, for the reason the repository's list does the same: a merge box that
      // came back without the branches is not a reason to unfold a stack.
      const live = branches.get(keyOf(one.reference))
      return live !== undefined && Option.isSome(live) ? live : Option.fromNullishOr(kept.branches.get(keyOf(one.reference)))
    },
    issues
  )
})
