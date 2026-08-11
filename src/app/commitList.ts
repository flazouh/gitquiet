import { Effect, Option } from "effect"
import type { CommitList, History, Marks, Stat, Stats } from "../domain/commitList"
import type { Participant } from "../domain/PullRequest"
import type { RepoRef } from "../domain/PullRequestRef"
import { withMarks } from "../domain/commitList"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * One page of a branch's commits, in the two answers GitHub gives for it.
 *
 * The list first, then the checks, the signatures and the comment counts. That
 * split is theirs: their own page draws the rows and asks a second route for the
 * rest, because a check rollup is a query per commit and forty of those in front
 * of the list would put a second on every page.
 *
 * So the rows are reported the moment they land, through `partly`, and the marks
 * fill in behind them. A caller with nowhere to put a half answer leaves the
 * argument out and gets only the return, which is the complete page.
 *
 * The second read is allowed to fail without taking the page with it. A history
 * with no checks column is a history; an error page where a list was is not, and
 * a deferred route is exactly the kind of thing GitHub changes the shape of.
 */
export const loadHistory = Effect.fn("loadHistory")(function* (
  list: CommitList,
  partly: (history: History) => void = () => {}
) {
  const gateway = yield* GitHubGateway
  const history = yield* gateway.commits(list)
  partly(history)

  if (Option.isNone(history.rest)) return history

  const marks = yield* gateway
    .commitMarks(list.repo, history.rest.value)
    .pipe(Effect.orElseSucceed((): Marks => new Map()))

  return withMarks(history, marks)
})

/**
 * How many commits are asked their size at once.
 *
 * Each is a fetch of that commit's diff, and a page holds up to thirty-five of
 * them. Four at a time fills a page in under a couple of seconds and never has
 * more of GitHub's rope out than their own page does — thirty-five at once
 * would be this interface deciding to look like something worth rate limiting.
 */
const AT_ONCE = 4

/**
 * The sizes for a page of commits: the ones already known first, then the rest.
 *
 * Two stages again, and a sharper split than the marks have. Every size this
 * browser has ever read is still true — a sha is a hash of the diff, so the
 * numbers cannot have changed — and they come back in a single read of the
 * store. A branch visited twice therefore draws its sizes on the first frame.
 *
 * Only what is missing goes to the network, one commit at a time because GitHub
 * offers no way to ask for forty. Each answer is reported through `tell` as it
 * lands rather than the page waiting on all of them, so the column fills from
 * the top while it is being read.
 *
 * A size that cannot be read is not an error anybody is told about. It is one
 * number missing from one row, on a page that is about the sentences.
 */
export const loadSizes = Effect.fn("loadSizes")(function* (
  list: CommitList,
  shas: ReadonlyArray<string>,
  tell: (sha: string, stat: Stat) => void
) {
  const gateway = yield* GitHubGateway
  const kept = yield* gateway.rememberedStats(shas).pipe(Effect.orElseSucceed((): Stats => new Map()))

  for (const [sha, stat] of kept) tell(sha, stat)

  const missing = shas.filter((sha) => !kept.has(sha))

  yield* Effect.forEach(
    missing,
    (sha) =>
      gateway.commitStat(list.repo, sha).pipe(
        Effect.map(Option.match({ onNone: () => {}, onSome: (stat) => tell(sha, stat) })),
        Effect.orElseSucceed(() => {})
      ),
    { concurrency: AT_ONCE, discard: true }
  )
})

/**
 * The same page as the last visit left it, where there was one.
 *
 * Worth showing for the half second before GitHub replies and not worth resting
 * on, as everywhere here. A commit that has landed does not change, which makes
 * this memory a better one than most: what a stale page is missing is the
 * commits pushed since, and those arrive at the top where they are noticed.
 */
export const rememberedHistory = Effect.fn("rememberedHistory")(function* (list: CommitList) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedCommits(list)
})

/**
 * Reads a page of history ahead of being asked for it, so that opening it is a
 * storage read.
 *
 * The page itself and not the sizes beside it. Their route answers with the commits
 * whole, which is the list; a size is a request per commit and is filled in on the
 * page, where the rows it belongs to are already drawn.
 */
export const warmHistory = Effect.fn("warmHistory")(function* (list: CommitList) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.commits(list))
})

/**
 * Every branch of the repository, for the picker: the kept list, then the live one.
 *
 * Reported through `partly` and returned, the same two stages the page itself
 * uses. A repository's branches are read whole — their route offers no other
 * shape — so the kept copy is the whole picker, opening full and instantly on
 * every visit after the first. What the live read adds is the branch somebody
 * pushed since, which is very often the branch they are looking for.
 */
export const loadBranches = Effect.fn("loadBranches")(function* (
  repo: RepoRef,
  partly: (branches: ReadonlyArray<string>) => void = () => {}
) {
  const gateway = yield* GitHubGateway
  const kept = yield* gateway
    .rememberedBranchesOf(repo)
    .pipe(Effect.orElseSucceed(() => Option.none<ReadonlyArray<string>>()))

  if (Option.isSome(kept)) partly(kept.value)

  return yield* gateway.branchesOf(repo)
})

/**
 * Everybody who has written a commit here, for the author filter.
 *
 * The same two stages as the branches beside it, and kept for the same reason:
 * the route has no cursor and no branch in it, so one read answers the filter on
 * every page of every branch of the repository, for as long as the answer is
 * kept.
 */
export const loadAuthors = Effect.fn("loadAuthors")(function* (
  list: CommitList,
  partly: (authors: ReadonlyArray<Participant>) => void = () => {}
) {
  const gateway = yield* GitHubGateway
  const kept = yield* gateway
    .rememberedAuthorsOf(list.repo)
    .pipe(Effect.orElseSucceed(() => Option.none<ReadonlyArray<Participant>>()))

  if (Option.isSome(kept)) partly(kept.value)

  return yield* gateway.authorsOf(list.repo)
})
