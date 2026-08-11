import { Effect, Layer, Option } from "effect"
import type { PullRequestRef, RepoRef } from "../../../src/domain/PullRequestRef"
import type { NewComment } from "../../../src/domain/PullRequest"
import type { Branches } from "../../../src/domain/sittings"
import { shelfOf } from "../../../src/domain/shelving"
import type { InvolvedPullRequest, Shelf, Size, Standings } from "../../../src/domain/workingSet"
import {
  GatewayError,
  GitHubGateway,
  type MergeMethod,
  type QueueMethod,
  type RememberedRows,
  type UpdateMethod,
  WorkingSetError
} from "../../../src/ports/GitHubGateway"
import type { WorkingSetRow } from "../shared/wire"
import { askForCard, askForCommit, askForPatches, askToRemark, askToSay, askToWrite } from "./card"
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
const involvedFrom = (row: WorkingSetRow): InvolvedPullRequest => ({
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

  const missing = (what: string) => (reference: PullRequestRef | RepoRef) =>
    Effect.fail(
      new GatewayError({
        reference,
        route: what,
        reason: "not-recorded",
        detail: `The desktop app cannot ${what} yet. Only the Working Set is wired up.`
      })
    )

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

    standingsFor: (ids: ReadonlyArray<number>) => {
      const wanted = new Set(ids)
      return Effect.succeed<Standings>(
        new Map(
          rows
            .filter((row) => wanted.has(row.id))
            .map((row) => [
              row.id,
              {
                checks: Option.fromNullishOr(row.checks),
                reviewed: Option.fromNullishOr(row.reviewed)
              }
            ])
        )
      )
    },

    branches: (reference: PullRequestRef) =>
      Effect.succeed(
        Option.map(
          Option.fromNullishOr(byKey.get(keyOf(reference))),
          (row): Branches => ({ baseBranch: row.baseBranch, headBranch: row.headBranch })
        )
      ),

    sizeOf: (reference: PullRequestRef) => {
      const row = byKey.get(keyOf(reference))
      if (row === undefined) return missing("size")(reference)
      return Effect.succeed<Size>({ added: row.added, deleted: row.deleted })
    },

    /**
     * The stacks and the sizes, both of them, in the one answer the list asks for.
     *
     * On GitHub's page this is the store: the branches and the sizes are a read
     * per row there, so what was kept from last time is stood under the list
     * while those reads go out. Here they arrived with the rows — the same
     * request that filled the list carried both — so this is not a memory of an
     * older read at all. It is the read, answered again in the shape the caller
     * wants it in.
     */
    rememberedRows: () =>
      Effect.succeed<RememberedRows>({
        branches: new Map(
          rows.map((row) => [
            `${row.owner}/${row.repo}#${row.number}`,
            { baseBranch: row.baseBranch, headBranch: row.headBranch }
          ])
        ),
        sizes: new Map(rows.map((row) => [row.id, { added: row.added, deleted: row.deleted }]))
      }),

    // Not on this screen and not faked. A hovercard with a real face and no
    // contributions is worse than no hovercard: it reads as a person who has
    // done nothing.
    portrait: () => Effect.succeed(Option.none()),
    contributions: () => Effect.succeed(Option.none()),

    // The repository list, which this window does not have yet.
    search: () => Effect.fail(refused("search", "The desktop app has no repository list yet.")),
    rememberedSearch: () => Effect.succeed(Option.none()),

    /*
     * The issues owed to whoever is signed in, which this window is not given.
     *
     * Answered rather than left off, and answered with nothing rather than with a
     * failure. Leaving the property undefined is the exact fault the test beside
     * this file guards: the call is on nothing, which is a defect rather than a
     * failure, and a defect never reaches the screen's word for "this went wrong" —
     * the window simply stops reading and says it is still reading, forever. The
     * Working Set treats an empty answer as a Court with no issues in it, which is
     * this window as it stands.
     */
    involvedIssues: () => Effect.succeed([]),
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

    notes: missing("read check notes"),
    log: missing("read a log"),
    tail: missing("tail a log"),
    steps: missing("read job steps"),
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

    // A review is not offered on this card: it needs a verdict — approve, request
    // changes, or merely comment — and a place to choose one, which is its own
    // screen's worth of work. Left as an error that names itself.
    review: missing("review")
  })
}
