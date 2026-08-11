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
import { ControlCenter } from "./ControlCenter"
import { Description } from "./Description"
import { Merge, type MergeActions } from "./Merge"

/**
 * The column that answers "what is this pull request, and can it land".
 *
 * Only assembly: which panels there are, in what order, fed from which parts of
 * the snapshot. Every question any of them answers is answered in its own file
 * or in the domain, which is what keeps this one readable at a glance.
 *
 * What is owed comes first and the five panels keep their order under it. The
 * five are filed by what a thing is, which is the right order for reading a pull
 * request and the wrong one for finding out what is left of it — so the list of
 * what is left is drawn once, at the top, rather than assembled by a reader
 * scrolling five panels and holding the total in their head.
 */
export const About = ({
  snapshot,
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
  /** Marks one thread resolved, for the finding rows of the panel at the top. */
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
    {/* The same way in the failing logs use, which is the same act: a row names
        a line of code and pressing it puts that line in the pane to the right. */}
    <ControlCenter
      snapshot={snapshot}
      onOpen={reach?.onOpenFile}
      onOpenCommit={onOpenCommit}
      onSettle={onSettle}
    />
    <Description html={snapshot.description.html} />
    <Checks
      checks={snapshot.checks}
      library={notes}
      logs={logs}
      tails={tails}
      steps={steps}
      reach={reach}
    />
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
    {/*
     * Under the conversation, because that is where the reading ends: a reader who has been
     * through the threads and the remarks has formed the thought this panel is for. Their own
     * page keeps it at the top of another tab, behind a dialog.
     */}
    {onReview === undefined || viewer === undefined ? null : (
      <Verdict
        reviews={snapshot.reviews}
        viewer={viewer}
        author={snapshot.author}
        headSha={snapshot.headSha}
        keep={`verdict:${snapshot.reference.owner}/${snapshot.reference.repo}#${snapshot.reference.number}`}
        suggest={suggest}
        onUpload={onUpload}
        onReview={onReview}
      />
    )}
    <Commits
      commits={snapshot.commits}
      repository={snapshot.reference}
      onOpen={onOpenCommit}
      onWarm={onWarmCommit}
      opened={openedCommit}
    />
    <Merge
      merge={snapshot.merge}
      files={snapshot.files}
      reviews={snapshot.reviews}
      running={stillRunning(snapshot.checks)}
      url={toUrl(snapshot.reference)}
      state={snapshot.state}
      headRef={snapshot.headRef}
      actions={actions}
    />
  </div>
)
