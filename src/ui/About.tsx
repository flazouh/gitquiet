import { stillRunning } from "../domain/checks"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import type { CheckLogs, CheckNotes, CheckTails, LogReach } from "./CheckDialog"
import { Checks } from "./Checks"
import { Commits } from "./Commits"
import { Conversation } from "./Conversation"
import { Description } from "./Description"
import { Merge, type MergeActions } from "./Merge"

/**
 * The column that answers "what is this pull request, and can it land".
 *
 * Only assembly: which panels there are, in what order, fed from which parts of
 * the snapshot. Every question any of them answers is answered in its own file
 * or in the domain, which is what keeps this one readable at a glance.
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
  reach
}: {
  readonly snapshot: PullRequestSnapshot
  readonly actions?: MergeActions
  readonly onOpenCommit?: (sha: string) => void
  readonly onWarmCommit?: (sha: string) => void
  readonly openedCommit?: string
  readonly notes?: CheckNotes
  readonly logs?: CheckLogs
  readonly tails?: CheckTails
  readonly reach?: LogReach
}) => (
  <div className="flex w-[26rem] shrink-0 flex-col gap-1.5">
    <Description html={snapshot.description.html} />
    <Checks
      checks={snapshot.checks}
      library={notes}
      logs={logs}
      tails={tails}
      reach={reach}
    />
    <Conversation threads={snapshot.threads} />
    <Commits
      commits={snapshot.commits}
      repository={snapshot.reference}
      onOpen={onOpenCommit}
      onWarm={onWarmCommit}
      opened={openedCommit}
    />
    <Merge
      merge={snapshot.merge}
      reviews={snapshot.reviews}
      running={stillRunning(snapshot.checks)}
      url={toUrl(snapshot.reference)}
      state={snapshot.state}
      actions={actions}
    />
  </div>
)
