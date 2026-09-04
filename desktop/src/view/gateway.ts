import { Effect, Layer, Option } from "effect"
import type { PullRequestRef, RepoRef } from "../../../src/domain/PullRequestRef"
import type { Check, MergeMethod, NewComment } from "../../../src/domain/PullRequest"
import type { Branches } from "../../../src/domain/sittings"
import { homeRef } from "../../../src/domain/discussions"
import { shelfOf } from "../../../src/domain/shelving"
import type { InvolvedPullRequest, Shelf, Size, Standings } from "../../../src/domain/workingSet"
import {
  GatewayError,
  GitHubGateway,
  type QueueMethod,
  type RememberedRows,
  type UpdateMethod,
  WorkingSetError
} from "../../../src/ports/GitHubGateway"
import type { WorkingSetRow } from "../shared/wire"
import { asLanded } from "../../../src/github/landed"
import { preferredWay } from "../shared/merging"
import {
  askForCard,
  askForCommit,
  askForSize,
  askHowToMerge,
  askForPatches,
  askToRemark,
  askToReply,
  askToReview,
  askToSay,
  askToSettle,
  askToUnsettle,
  askToWrite
} from "./card"
import {
  askForInvolvedIssues,
  askForIssue,
  askForIssueSearch,
  askForRepositories,
  askToDeleteBranch,
  askToRaise,
  askToReopenIssue,
  askToSayOnIssue,
  askToSettleIssue
} from "./askIssue"
import {
  askForActivity,
  askForAuthors,
  askForBlameAt,
  askForBranches,
  askForBuilds,
  askForCommitMarks,
  askForCommits,
  askForCommitStat,
  askForFileAt,
  askForRepoHome,
  askForLog,
  askForNotices,
  askForNotes,
  askForPerson,
  askForPersonRepositories,
  askForRawFileAt,
  askForReleases,
  askForRun,
  askForSearch,
  askForStanding,
  askForSteps,
  askForStrands,
  askForSuggesting,
  askForTabs,
  askForTail,
  askForTreeCommits,
  askForTreePaths,
  askForWhoTouched,
  askToCancelRun,
  askToMakeStack,
  askToMergeStack,
  askToPressNotice,
  askToRerun,
  askToStar,
  askToUpload
} from "./askRepo"
import { keptCard } from "./kept"
import { snapshotFrom } from "./snapshot"
import { ask } from "./rpc"

/**
 * The gateway, for a window whose GitHub is the documented one.
 *
 * The port is the same port the extension satisfies, and the interface above it
 * cannot tell which is underneath — that being the entire claim the hexagon
 * makes, and this file is where it either holds or does not.
 *
 * It is built per read rather than once, and that is the design rather than an
 * oversight. `loadWorkingSet` asks for six shelves, then the standings, then the
 * branches and the sizes, which on GitHub's dashboard is a dozen requests; here
 * all of it came back in one, before the layer existed. So the rows are handed to
 * the layer and every method answers from them. Nothing is cached, nothing goes
 * stale, and there is no shared mutable state deciding whether a refresh gets
 * this read's rows or the last one's.
 */

const keyOf = (reference: PullRequestRef): string =>
  `${reference.owner}/${reference.repo}#${reference.number}`

/**
 * The refusal every Discussions method of this port answers with.
 *
 * The rest of the window reaches GitHub through the documented API with a token. Discussions are
 * read by scraping the page GitHub serves, and this window loads no page, so there is nothing
 * here to read them off. A refusal names the page it was about, which is what `homeRef` is for.
 *
 * Written out rather than left off, because a method left off is a call on nothing. That is a
 * defect and never reaches the screen's word for "this went wrong": the window sits there saying
 * it is still reading.
 */
const noPageToRead = (what: string) => (reference: RepoRef) =>
  Effect.fail(
    new GatewayError({
      reference,
      route: what,
      reason: "not-recorded",
      detail: `The desktop app cannot ${what}. It reaches GitHub without loading a page.`
    })
  )

const refused = (route: string, detail: string) =>
  new WorkingSetError({ route, reason: "rejected", detail })

/**
 * The one place a row becomes a pull request the interface understands.
 *
 * Checks, reviews and size are left absent even though this row has all three,
 * because the app layer fills them from `standingsFor` and `sizeOf` a moment
 * later and `withStandings` would overwrite whatever was here. Answering those
 * methods from the same rows gets them there by the route the app expects
 * instead of smuggling them in early.
 */
const involvedFrom = (row: WorkingSetRow): InvolvedPullRequest =>
  asLanded({
  reference: { owner: row.owner, repo: row.repo, number: row.number },
  id: row.id,
  title: row.title,
  author: {
    login: row.authorLogin,
    isAutomated: row.authorIsBot,
    faceUrl: Option.fromNullishOr(row.authorFaceUrl)
  },
  state: row.state,
  shelf: shelfOf({
    viewerIsAuthor: row.viewerIsAuthor,
    draft: row.state === "draft",
    inMergeQueue: row.inMergeQueue,
    askedOfViewer: row.askedOfViewer,
    askedOfTeam: row.askedOfTeam,
    reviewed: Option.fromNullishOr(row.reviewed),
    checks: Option.fromNullishOr(row.checks)
  }),
  // GitHub's own word for why a row needs attention comes off their dashboard's
  // `category`, and the documented API has nothing like it. Absent rather than
  // invented: the Court comes from the shelf, so this costs a label and no more.
  why: Option.none(),
  readByViewer: row.readByViewer,
  comments: row.comments,
  labels: row.labels,
  assignees: row.assignees,
  openedAt: row.openedAt,
  changedAt: row.changedAt,
  headSha: row.headSha,
  // Their signed socket tokens are minted for a page of theirs, and there is no
  // page of theirs here. Live updates will be a poll rather than a socket.
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none()
  })

/**
 * Every pull request the reader is in, asked of the process holding the token.
 *
 * The reason a read failed is said out loud on the way past. The screens draw
 * one failure the same as any other — deliberately, because a reader can do
 * nothing with a route name — so without this the detail GitHub or the bridge
 * gave would be carried into a `WorkingSetError` and never shown to anybody.
 */
export const askForRows = Effect.fn("askForRows")(function* () {
  const answered = yield* Effect.tryPromise({
    try: () => ask("workingSet", undefined),
    catch: (cause) => {
      console.error("[working-set] the bridge refused:", cause)
      return refused("workingSet", String(cause))
    }
  })

  if (!answered.ok) {
    console.error("[working-set] GitHub refused:", answered.why)
    return yield* Effect.fail(refused("workingSet", answered.why))
  }

  return answered.it
})

/**
 * A gateway that knows the two screens this window has, and says so about the rest.
 *
 * The rows are for the list, and only the list: the card is its own read and asks
 * for itself, which is why a card screen can build this with an empty array and
 * get something that works.
 *
 * What is left is not stubbed with empty successes. A check dialog drawn from a
 * log nobody fetched is a panel of confident blanks, so asking is an error that
 * names itself rather than a quiet nothing somebody has to debug backwards.
 */
export const gatewayFrom = (rows: ReadonlyArray<WorkingSetRow>) => {
  const involved = rows.map(involvedFrom)
  const byKey = new Map(rows.map((row) => [`${row.owner}/${row.repo}#${row.number}`, row]))

  /**
   * Where every row's checks and reviews are read off, for both callers that ask.
   *
   * One function rather than two, because the two are the same answer to the same
   * question asked at two moments: `standingsFor` is the live read arriving, and the
   * standings inside {@link RememberedRows} are the kept read being stood up. They were
   * written out separately and then one of them was not written at all, which is a
   * whole list drawn with no word for its checks.
   */
  const standings = (wanted?: ReadonlySet<string>): Standings =>
    new Map(
      rows
        .filter((row) => wanted === undefined || wanted.has(row.id))
        .map((row) => [
          row.id,
          {
            checks: Option.fromNullishOr(row.checks),
            reviewed: Option.fromNullishOr(row.reviewed)
          }
        ])
    )

  const branchesIn = (): ReadonlyMap<string, Branches> =>
    new Map(
      rows.map((row) => [
        keyOf({ owner: row.owner, repo: row.repo, number: row.number }),
        { baseBranch: row.baseBranch, headBranch: row.headBranch }
      ])
    )

  const sizesIn = () =>
    new Map(rows.map((row) => [row.id, { added: row.added, deleted: row.deleted }]))

  return Layer.succeed(GitHubGateway, {
    workingSet: (shelf: Shelf) =>
      Effect.succeed(
        involved.filter((one) => Option.isSome(one.shelf) && one.shelf.value === shelf)
      ),

    /**
     * The same rows, for a caller who asked what was remembered.
     *
     * Which of the two this is depends entirely on where the rows came from, and
     * the caller is the one who knows: the list builds this layer twice, once
     * around what GitHub just said and once around what was on disk, and asks
     * each the question it built it for. Answering both from the rows is
     * therefore not a shortcut — a shelf of remembered rows is what a remembered
     * shelf is.
     *
     * Nothing at all when there are no rows, which is the case that matters: the
     * card screen builds this with an empty array, and a Some of an empty shelf
     * would let `rememberedWorkingSet` paint a confident empty list over a read
     * that had not finished.
     */
    rememberedShelf: (shelf: Shelf) =>
      Effect.succeed(
        rows.length === 0
          ? Option.none()
          : Option.some(
              involved.filter((one) => Option.isSome(one.shelf) && one.shelf.value === shelf)
            )
      ),

    standingsFor: (ids: ReadonlyArray<string>) => Effect.succeed(standings(new Set(ids))),

    branches: (reference: PullRequestRef) =>
      Effect.succeed(
        Option.map(
          Option.fromNullishOr(byKey.get(keyOf(reference))),
          (row): Branches => ({ baseBranch: row.baseBranch, headBranch: row.headBranch })
        )
      ),

    sizeOf: (reference: PullRequestRef) => {
      const row = byKey.get(keyOf(reference))
      if (row !== undefined) return Effect.succeed<Size>({ added: row.added, deleted: row.deleted })
      return askForSize(reference)
    },

    /**
     * The branches, the sizes and the standings, in the one answer the list asks for.
     *
     * On GitHub's page this is the store: the branches and the sizes are a read
     * per row there, so what was kept from last time is stood under the list
     * while those reads go out. Here they arrived with the rows — the same
     * request that filled the list carried all three — so this is not a memory of
     * an older read at all. It is the read, answered again in the shape the caller
     * wants it in.
     *
     * All three, the standings included. They were left off, and the answer was
     * therefore an object the caller reads a `Map` off of and finds nothing at: the
     * kept list died on the way to the screen, so pressing back to the list showed
     * "Reading your pull requests…" for eight seconds with fifty-two rows already on
     * disk. Measured, before and after.
     */
    rememberedRows: () =>
      Effect.succeed<RememberedRows>({
        branches: branchesIn(),
        sizes: sizesIn(),
        standings: standings()
      }),

    // Not on this screen and not faked. A hovercard with a real face and no
    // contributions is worse than no hovercard: it reads as a person who has
    // done nothing.
    portrait: () => Effect.succeed(Option.none()),
    contributions: () => Effect.succeed(Option.none()),

    search: (query, page) =>
      Effect.map(askForSearch(query, page), (found) => ({
        rows: found.rows.map(involvedFrom),
        pages: Option.some({ current: found.current, total: found.total, count: found.count })
      })),
    rememberedSearch: () => Effect.succeed(Option.none()),

    involvedIssues: askForInvolvedIssues,
    rememberedInvolvedIssues: () => Effect.succeed(Option.none()),

    /*
     * The card, read on demand rather than from the rows.
     *
     * Nothing about a snapshot comes from the Working Set — it is its own read, of
     * its own screen — so these two answer whether or not this layer was built
     * with any rows. That is what lets the card screen ask for a gateway with an
     * empty list and get one that works.
     */
    snapshot: (reference: PullRequestRef) => askForCard(reference),
    /*
     * The checks as they arrived, because this window has no run page to read.
     *
     * A tolerated failure is a job that failed under a run that succeeded, and
     * the pair is written on GitHub's own run document; the main process reads
     * their documented API, which says nothing about either half. Answered all
     * the same, and never left out: `loadPullRequest` asks every gateway this,
     * and a method this layer does not answer is a defect that stops the read
     * where no console says why.
     */
    tolerated: (checks: ReadonlyArray<Check>) => Effect.succeed(checks),
    diffs: (reference: PullRequestRef, _head: string, paths: ReadonlyArray<string>) =>
      askForPatches(reference, paths),

    /**
     * The card as it was the last time this pull request was open.
     *
     * Read from the window's own storage, so it is on screen in about the time a
     * `JSON.parse` takes against the two-to-three seconds GitHub needs to answer.
     * What it draws is everything but the diff: the file content is not kept, for
     * the reason in `keepCard`, so the tree arrives at once and the code arrives
     * with the read.
     */
    remembered: (reference: PullRequestRef) =>
      Effect.sync(() => {
        const facts = keptCard(reference)
        return facts === null
          ? Option.none()
          : Option.some(snapshotFrom(reference, facts))
      }),

    notes: askForNotes,
    log: askForLog,
    tail: askForTail,
    steps: askForSteps,
    commit: (reference: RepoRef, sha: string) => askForCommit(reference, sha),
    // REST embeds every patch GitHub will send on the first read, so there is
    // nothing left to walk for. Withheld / binary files stay that way.
    commitDiffs: (_reference: RepoRef, _sha: string, _paths: ReadonlyArray<string>) =>
      Effect.succeed([]),

    /*
     * The eight writes, each one press of a button the card asked twice about.
     *
     * Thin on purpose: the mutation, the node id it needs and the one refusal
     * GitHub cannot be asked for all live in the main process, and what is left
     * here is the port's word for what happened translated into the wire's.
     */
    merge: (reference: PullRequestRef, method: MergeMethod) =>
      askToWrite(reference, { doing: "merge", method }),
    enqueue: (reference: PullRequestRef, how: QueueMethod) =>
      askToWrite(reference, { doing: "enqueue", how }),
    dequeue: (reference: PullRequestRef) => askToWrite(reference, { doing: "dequeue" }),
    cancelAutoMerge: (reference: PullRequestRef) =>
      askToWrite(reference, { doing: "cancelAutoMerge" }),
    updateBranch: (reference: PullRequestRef, how: UpdateMethod) =>
      askToWrite(reference, { doing: "updateBranch", how }),
    close: (reference: PullRequestRef) => askToWrite(reference, { doing: "close" }),
    reopen: (reference: PullRequestRef) => askToWrite(reference, { doing: "reopen" }),
    markReady: (reference: PullRequestRef) => askToWrite(reference, { doing: "markReady" }),
    toDraft: (reference: PullRequestRef) => askToWrite(reference, { doing: "toDraft" }),

    /*
     * A remark on some lines, which is the one write that draws its own answer.
     *
     * The reader typed it into the diff, so the thread comes back and is drawn
     * beside the threads that were already there rather than waiting for the card
     * to be read again.
     */
    comment: (reference: PullRequestRef, note: NewComment) => askToSay(reference, note),

    /* Said about the pull request rather than about a line, and drawn where it was
       written for the same reason. */
    remark: (reference: PullRequestRef, body: string) => askToRemark(reference, body),

    review: (reference: PullRequestRef, review) => askToReview(reference, review),
    settle: (reference: PullRequestRef, threadId: string) => askToSettle(reference, threadId),
    unsettle: (reference: PullRequestRef, threadId: string) => askToUnsettle(reference, threadId),
    reply: (reference: PullRequestRef, commentId: string, body: string) =>
      askToReply(reference, commentId, body),

    /*
     * The same question the extension asks its merge box, answered from the only
     * place this window can ask: the repository's own settings, which is where
     * those verdicts come from anyway.
     *
     * `stacked` is false because nothing here can find out, not because anything
     * checked. This window draws no stacks — `snapshot.ts` hands the merge box
     * `stack: Option.none()` and holds to it — so the ordinary route is the only
     * one it can send to. Press it on a layer of a real stack and GitHub answers
     * 422, and the reader gets their sentence about a branch being out of date.
     */
    howToMerge: (reference: PullRequestRef) =>
      Effect.map(askHowToMerge(reference), (found) => ({
        method: Option.fromNullishOr(preferredWay(found.ways)),
        stacked: found.stacked
      })),

    /*
     * A branch chain the documented search can see. Official GitHub stacks still
     * refuse the ordinary merge route; makeStack says so rather than pretending.
     */
    mergeStack: askToMergeStack,
    makeStack: askToMakeStack,
    deleteBranch: askToDeleteBranch,

    /*
     * A commit as it was last read.
     *
     * This window keeps rows and cards — see `kept.ts` — and does not keep commits:
     * a commit is a read of a few hundred milliseconds against a card that is
     * already on the screen, so there is nothing here worth the disk. Nothing
     * remembered is the true answer rather than a gap.
     */
    rememberedCommit: () => Effect.succeed(Option.none()),

    /*
     * A repository's own pages: its home, its tree, its tabs, its files.
     *
     * This window has two screens and neither of them is a repository. Every one of
     * these stands on a page it has not built, so each says its own name rather than
     * answering with a confident nothing — a file browser drawn from an empty tree
     * reads as a repository with no files in it.
     */
    repoHome: askForRepoHome,
    rememberedRepoHome: () => Effect.succeed(Option.none()),
    standing: askForStanding,
    star: askToStar,
    tabs: askForTabs,
    rememberedTabs: () => Effect.succeed(Option.none()),
    suggesting: askForSuggesting,
    upload: askToUpload,
    treePaths: askForTreePaths,
    fileAt: askForFileAt,
    // Blame is a screen this window has not built. It is a page of GitHub's
    // code view, and this gateway reaches GitHub through the documented API
    // rather than through page routes, so there is nothing here to read it
    // with until that screen exists.
    blameAt: askForBlameAt,
    rawFileAt: askForRawFileAt,
    treeCommits: askForTreeCommits,
    whoTouched: askForWhoTouched,
    branchesOf: askForBranches,
    rememberedBranchesOf: () => Effect.succeed(Option.none()),
    authorsOf: askForAuthors,
    rememberedAuthorsOf: () => Effect.succeed(Option.none()),

    /*
     * A repository's history, rather than one commit of it.
     *
     * One commit is answered above, that being what a card's own commit panel opens.
     * The page listing them all is a screen this window has not built, and the marks
     * and the sizes belong to its rows. The kept sizes are an empty map rather than a
     * failure, because the caller reads that map for a row it is already drawing.
     */
    commits: askForCommits,
    rememberedCommits: () => Effect.succeed(Option.none()),
    commitMarks: askForCommitMarks,
    commitStat: askForCommitStat,
    rememberedStats: () => Effect.succeed(new Map()),

    /*
     * The Actions tab: runs, the workflows behind them, and the two buttons that act.
     *
     * Named against the repository a run is in, that being the widest thing its own
     * reference carries and the only part of it a failure has a word for.
     */
    run: askForRun,
    rerunRun: askToRerun,
    cancelRun: askToCancelRun,
    rememberedRun: () => Effect.succeed(Option.none()),
    strands: askForStrands,
    rememberedStrands: () => Effect.succeed(Option.none()),

    // The Releases tab, which is a screen this window has not built either.
    releases: askForReleases,
    builds: askForBuilds,
    rememberedReleases: () => Effect.succeed(Option.none()),

    /*
     * The Discussions tab, and this one is refused for a second reason on top of the
     * screen not being here. The extension reads it by scraping the document GitHub
     * serves, and this window has no page to scrape: it reaches GitHub through the
     * documented API with a token, and that API answers discussions through GraphQL
     * rather than through the routes this port's other reads use.
     */
    discussions: (list) => noPageToRead("read discussions")(homeRef(list.home)),
    rememberedDiscussions: () => Effect.succeed(Option.none()),
    discussion: (reference) => noPageToRead("read a discussion")(homeRef(reference.home)),
    rememberedDiscussion: () => Effect.succeed(Option.none()),
    /*
     * And this one is refused twice over. Every press on a discussion is GitHub's own form sent
     * back, and a form only exists on a page somebody loaded. This window loads no page.
     */
    pressDiscussion: (reference) => noPageToRead("write on a discussion")(homeRef(reference.home)),
    // An empty menu, which is what a window with no page to read one from has.
    discussionDoings: () => Effect.succeed([]),

    /*
     * The inbox, a person's pages, the repository list and the activity feed.
     *
     * All of them are about the reader rather than about any one pull request, and
     * this window opens none of them: the bar's own inbox is a link that goes to the
     * browser. Refused rather than answered with nothing, because an empty inbox and
     * an empty feed are both things a reader would believe.
     */
    notices: askForNotices,
    rememberedNotices: () => Effect.succeed(Option.none()),
    pressNotice: askToPressNotice,
    personRepositories: (login, page) => askForPersonRepositories(login, page),
    person: (login) => askForPerson(login),
    rememberedPerson: () => Effect.succeed(Option.none()),
    repositories: askForRepositories,
    rememberedRepositories: () => Effect.succeed(Option.none()),
    activity: (login) => askForActivity(login),
    rememberedActivity: () => Effect.succeed(Option.none()),

    issue: askForIssue,
    rememberedIssue: () => Effect.succeed(Option.none()),
    issueSearch: askForIssueSearch,
    rememberedIssueSearch: () => Effect.succeed(Option.none()),
    settleIssue: askToSettleIssue,
    reopenIssue: askToReopenIssue,
    sayOnIssue: (reference, _id, body) => askToSayOnIssue(reference, body),
    raise: askToRaise
  })
}
