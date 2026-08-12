import { Effect, Option } from "effect"
import type { CommitDetail } from "../domain/PullRequest"
import type { RepoRef } from "../domain/PullRequestRef"
import {
  type Front,
  type Starring,
  type Touch,
  type TouchWho,
  namedBy,
  shasOf,
  touchedBy
} from "../domain/repoHome"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * Reads the part of a repository's front page that survives to the next visit.
 *
 * The pointer's version of {@link loadRepoHome}: the page itself, and not the
 * commit column. That column is a date and a headline per row, it is drawn the
 * same whether it is a second or a day old, and it arrives a quarter of a second
 * behind the rows — so there is nothing for reading it early to save.
 */
export const warmRepoHome = Effect.fn("warmRepoHome")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.repoHome(repo))
})

/**
 * The front page as it was last read, without asking GitHub.
 *
 * Without its README, which is dropped before anything is kept — see `keptFrom`.
 * A page opened from the store shows its tree, its branch and its About panel at
 * once and its welcome a moment later, which is the right way round: the tree is
 * what a Keeper came for, and a Caller reading a README a moment after the page
 * appears has lost nothing they would notice.
 */
export const rememberedRepoHome = Effect.fn("rememberedRepoHome")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedRepoHome(repo)
})

/** How many unique commits to name at once. One request per SHA, not per row. */
const AT_ONCE = 4

const whoFrom = (detail: CommitDetail): TouchWho => ({
  login: detail.author,
  face: detail.avatarUrl
})

/**
 * Faces for the unique SHAs the column still has no author for.
 *
 * One read per commit, not per row: many files share a SHA. A SHA the first
 * route already named is skipped. A SHA that fails to read keeps the message,
 * the age and the link.
 */
export const fillWho = Effect.fn("fillWho")(function* (
  touches: ReadonlyMap<string, Touch>,
  whoOf: (sha: string) => Effect.Effect<TouchWho, unknown>
) {
  const shas = shasOf(touches)
  if (shas.length === 0) return touches

  const found = yield* Effect.forEach(
    shas,
    (sha) =>
      whoOf(sha).pipe(
        Effect.map((who) => Option.some([sha, who] as const)),
        Effect.orElseSucceed(() => Option.none<readonly [string, TouchWho]>())
      ),
    { concurrency: AT_ONCE }
  )

  return namedBy(touches, new Map(found.flatMap((one) => Option.toArray(one))))
})

/**
 * A repository's front page.
 *
 * Two reads, and only one of them is ever a request.
 *
 * The page itself is handed in where the reader loaded this very address, because
 * GitHub already put the whole of it in the document: the tree, the README
 * rendered to HTML, the About panel, and the field saying whether the reader can
 * push. That path costs nothing — no fetch, no wait, no round trip — and it is the
 * common one, since this is the address the rest of GitHub links to. Where it is
 * not to be had, the same payload is fetched as a document, which is the only
 * answer carrying that last field.
 *
 * The commit column is the second read and the only request this page makes on
 * the fast path. It is reported through `partly` the moment it lands rather than
 * held back, so the file list is on the screen in one paint and gains its column a
 * quarter of a second later. Held back instead, every row would wait on a read
 * that decorates it.
 *
 * Faces fill in behind the column. Unique SHAs are named after the messages are
 * already on the rows, so a slow author read cannot hold the dates back.
 *
 * The column fails quietly. It only ever adds to a row already worth drawing, and
 * a repository whose history is too large for GitHub to answer about is a
 * repository whose file list is still the page.
 */
export const loadRepoHome = Effect.fn("loadRepoHome")(function* (
  repo: RepoRef,
  having: Option.Option<Front>,
  partly: (front: Front) => void = () => {}
) {
  const gateway = yield* GitHubGateway

  const front = Option.isSome(having) ? having.value : yield* gateway.repoHome(repo)

  // Announced before the column is asked for, which is the whole point of the
  // split: the rows are complete and the reader can act on them now.
  partly(front)

  const touches = yield* gateway
    .treeCommits(repo, front.head)
    .pipe(Effect.orElseSucceed((): ReadonlyMap<string, Touch> => new Map()))

  const withTouches = { ...front, entries: touchedBy(front.entries, touches) }
  partly(withTouches)

  const named = yield* fillWho(touches, (sha) =>
    gateway.rememberedCommit(repo, sha).pipe(
      Effect.orElseSucceed(() => Option.none()),
      Effect.flatMap((held) =>
        Option.match(held, {
          onNone: () => gateway.commit(repo, sha),
          onSome: (detail) => Effect.succeed(detail)
        })
      ),
      Effect.map(whoFrom)
    )
  )
  return { ...front, entries: touchedBy(front.entries, named) }
})

/**
 * What the repository stands on, for the card above the two blocks.
 *
 * Asked for on its own rather than folded into the read above, so a slow
 * `_sidebar` cannot hold the commit column back and a failed one costs a card
 * rather than a page. The screen draws it when it lands and draws nothing until
 * then.
 */
export const loadStanding = Effect.fn("loadStanding")(function* (repo: RepoRef) {
  const gateway = yield* GitHubGateway
  return yield* gateway.standing(repo)
})

/**
 * Every path in the repository, for the folders in the tree.
 *
 * Behind the root, never in front of it. The root directory is in the page
 * already and is drawn from there; this is six hundred kilobytes on a large
 * repository, and a tree that waits for it is a tree that arrives after the
 * README.
 */
export const loadTreePaths = Effect.fn("loadTreePaths")(function* (repo: RepoRef, sha: string) {
  const gateway = yield* GitHubGateway
  return yield* gateway.treePaths(repo, sha)
})

/** One file, for the pane where the README usually is. */
export const loadFile = Effect.fn("loadFile")(function* (
  repo: RepoRef,
  branch: string,
  path: string
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.fileAt(repo, branch, path)
})

/**
 * Star a repository, or take the star back.
 *
 * The failure is kept rather than swallowed. The button is what the reader is
 * watching, and it puts itself back where this fails, so a refusal that never
 * reached the screen would leave a star nobody gave.
 */
export const starRepo = Effect.fn("starRepo")(function* (repo: RepoRef, to: Starring) {
  const gateway = yield* GitHubGateway
  yield* gateway.star(repo, to)
})
