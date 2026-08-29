import type { Effect } from "effect"
import { stillRunning } from "../domain/checks"
import type { PullRequestSnapshot, Remark } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import type { CheckLogs, CheckNotes, CheckTails, LogReach } from "./checkReads"
import type { CheckSteps } from "./CheckSteps"
import { Checks } from "./Checks"
import { Commits } from "./Commits"
import { Conversation } from "./Conversation"
import type { Answering } from "./ThreadView"
import { Verdict } from "./Verdict"
import type { Review as Said } from "../ports/GitHubGateway"
import { Description } from "./Description"
import type { MergeActions } from "./Ask"
import { Merge } from "./Merge"

/**
 * The column that answers "what is this pull request, and can it land".
 *
 * Only assembly: which panels there are, in what order, fed from which parts of
 * the snapshot. Every question any of them answers is answered in its own file
 * or in the domain, which is what keeps this one readable at a glance.
 *
 * Merge comes first, because it is the one panel a reader acts from. It carries
 * whether the thing can land, what is standing in the way of it landing, and the
 * verbs that land it — so it is read on arrival and returned to after every other
 * panel, and a panel read twice belongs at the top rather than under five others.
 *
 * The five under it are filed by what a thing is, which is the right order for
 * reading a pull request. There is no panel here that adds them up. One was tried
 * — a list of what was owed, filed by whose move it is — and it read as a second
 * copy of the merge card on a pull request with nothing outstanding, which is most
 * of them. What is left is on the card that says what is holding the thing up.
 */
export const About = ({
  snapshot,
  prepareThrough = 11,
  actions,
  onOpenCommit,
  onWarmCommit,
  openedCommit,
  notes,
  logs,
  tails,
  steps,
  reach,
  viewer,
  onSay,
  onSettle,
  onUnsettle,
  onReply,
  onReview,
  suggest,
  onUpload,
  remarks
}: {
  readonly snapshot: PullRequestSnapshot
  /**
   * How many stages a detached route has spent here, which is not a count of
   * panels: Merge takes five of them and Verdict two, so the six panels below
   * are spread over eleven.
   */
  readonly prepareThrough?: number
  readonly actions?: MergeActions
  readonly onOpenCommit?: (sha: string) => void
  readonly onWarmCommit?: (sha: string) => void
  readonly openedCommit?: string
  readonly notes?: CheckNotes
  readonly logs?: CheckLogs
  readonly tails?: CheckTails
  readonly steps?: CheckSteps
  readonly reach?: LogReach
  /** Whoever is writing, for the box at the foot of the conversation. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /** Says something about the pull request. Absent where nothing is wired up to. */
  readonly onSay?: (body: string) => Effect.Effect<unknown, unknown>
  /** Marks one thread resolved, from the head of the thread in the conversation. */
  readonly onSettle?: (threadId: string) => Effect.Effect<unknown, unknown>
  /** Opens a resolved thread again, from the foot of the thread itself. */
  readonly onUnsettle?: Answering["onUnsettle"]
  /** Answers inside a thread, and says what it holds afterwards. */
  readonly onReply?: Answering["onReply"]
  /**
   * Says what this reader thinks of it, from the panel under the conversation.
   *
   * Absent where nothing is wired up to, which is every test about something else.
   */
  readonly onReview?: (review: Said) => Effect.Effect<unknown, unknown>
  /** Who can be mentioned and what can be referred to, for every box here. */
  readonly suggest?: Answering["suggest"]
  /** A file pasted or dropped into a box here. See `attaching.ts`. */
  readonly onUpload?: Answering["onUpload"]
  /**
   * Everything said about the pull request, when the caller is holding more of it
   * than the snapshot is: a remark posted a moment ago is in the interface because
   * it was put there, and the snapshot it came back beside is a page older.
   */
  readonly remarks?: ReadonlyArray<Remark>
}) => (
  <div className="t-panels flex w-[26rem] shrink-0 flex-col gap-1.5">
    {/* Both absences go in as they are. Which face the card wears, and in what order
        the three are decided, is `faceOf`'s answer and not this file's.

        First on the screen and first to be built, and it takes the four stages
        of its own that it asks for: the blockers, the queue and the buttons
        land over stages four to seven. First rather than exempt, which is the
        order a reader reads the column in. */}
    {prepareThrough >= 1 ? (
      <Merge
        merge={snapshot.merge}
        files={snapshot.files}
        reviews={snapshot.reviews}
        running={stillRunning(snapshot.checks)}
        url={toUrl(snapshot.reference)}
        state={snapshot.state}
        headRef={snapshot.headRef}
        actions={actions}
        prepareThrough={Math.min(prepareThrough - 1, 4)}
      />
    ) : null}
    {prepareThrough >= 6 ? (
      <Description
        markdown={snapshot.description.markdown}
        owner={snapshot.reference.owner}
        repo={snapshot.reference.repo}
      />
    ) : null}
    {prepareThrough >= 7 ? (
      <Checks
        checks={snapshot.checks}
        library={notes}
        logs={logs}
        tails={tails}
        steps={steps}
        reach={reach}
      />
    ) : null}
    {prepareThrough >= 8 ? (
      <Conversation
        threads={snapshot.threads}
        remarks={remarks ?? snapshot.remarks}
        viewer={viewer}
        keep={`pull:${snapshot.reference.owner}/${snapshot.reference.repo}#${snapshot.reference.number}`}
        suggest={suggest}
        onUpload={onUpload}
        onReply={onReply}
        onSettle={onSettle}
        onUnsettle={onUnsettle}
        onSay={onSay}
      />
    ) : null}
    {/*
     * Under the conversation, because that is where the reading ends: a reader who has been
     * through the threads and the remarks has formed the thought this panel is for. Their own
     * page keeps it at the top of another tab, behind a dialog.
     */}
    {/* Nothing to give a verdict on once the thing has landed or been dropped.
        GitHub's own page takes the panel away there too, and this one kept
        offering Approve and Request changes on a pull request that was merged
        an hour ago — the only panel in this column that never read the state. */}
    {prepareThrough < 9 ||
    onReview === undefined ||
    viewer === undefined ||
    snapshot.state === "merged" ||
    snapshot.state === "closed" ? null : (
      <Verdict
        reviews={snapshot.reviews}
        viewer={viewer}
        author={snapshot.author}
        headSha={snapshot.headSha}
        keep={`verdict:${snapshot.reference.owner}/${snapshot.reference.repo}#${snapshot.reference.number}`}
        suggest={suggest}
        onUpload={onUpload}
        onReview={onReview}
        prepareThrough={prepareThrough - 9}
      />
    )}
    {prepareThrough >= 11 ? (
      <Commits
        commits={snapshot.commits}
        repository={snapshot.reference}
        onOpen={onOpenCommit}
        onWarm={onWarmCommit}
        opened={openedCommit}
      />
    ) : null}
  </div>
)
