import { useCallback, useMemo, useRef, useState } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FetchedDiff,
  PullRequestSnapshot
} from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../settings/apply"
import { keptReads } from "../app/kept"
import { CommitView } from "./CommitView"
import { FileBrowser } from "./FileBrowser"
import { Header } from "./Header"
import { About, type MergeActions } from "./Sections"
import { SettingsMenu } from "./SettingsMenu"
import { useSettings } from "./useSettings"

export type ShellProps = {
  readonly snapshot: PullRequestSnapshot
  readonly fetchDiffs: (paths: ReadonlyArray<string>, head: string) => Promise<ReadonlyArray<FetchedDiff>>
  /** What the merge card can actually do, when anything is wired to it. */
  readonly actions?: MergeActions
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Promise<CommitDetail>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Promise<ReadonlyArray<CheckNote>>
}

const NO_READER = new Error("Nothing is wired to read commits.")

/**
 * The page: what this pull request is, beside what it changes.
 *
 * Two columns rather than tabs, because reading a diff and reading the reason
 * for it are the same act, and a tab makes you choose one. The left column is
 * fixed and scrolls on its own — description, CI, conversation, merge, in the
 * order anyone asks about them — and the right is the code, taking whatever
 * width is left.
 */
export const Shell = ({ snapshot, fetchDiffs, actions, loadCommit, loadNotes }: ShellProps) => {
  // Which commit is being read, if any. The rail does not change when one is —
  // the pull request is still the thing being reviewed, and a commit is a way
  // of looking at part of it.
  const [reading, setReading] = useState<string | undefined>(undefined)

  // A sha names something that cannot change, so every commit is read once and
  // kept: opening one a second time, or after a pointer warmed it on the way
  // past, costs nothing.
  const commits = useMemo(
    () => keptReads<string, CommitDetail>((sha) => loadCommit?.(sha) ?? Promise.reject(NO_READER)),
    [loadCommit]
  )
  // Notes are held by check name rather than by the check itself, so a
  // refreshed snapshot — a new object for the same run — still finds what was
  // already read. The checks are reached through a ref for the same reason:
  // the store outlives any one snapshot.
  const latest = useRef(snapshot.checks)
  latest.current = snapshot.checks
  const notes = useMemo(
    () =>
      loadNotes === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<CheckNote>>((name) => {
            const check = latest.current.find((one) => one.name === name)
            return check === undefined ? Promise.resolve([]) : loadNotes(check)
          }),
    [loadNotes]
  )
  // The head commit is what a diff is against, and it belongs to the snapshot
  // rather than to whoever wired the page up.
  const forThisHead = useCallback(
    (paths: ReadonlyArray<string>) => fetchDiffs(paths, snapshot.headSha),
    [fetchDiffs, snapshot.headSha]
  )

  // Read once here and handed down as two settled objects: the diff and the
  // rail should never be looking at different answers to the same question.
  const { settings, change } = useSettings()
  const diff = useMemo(() => diffChoices(settings.diff), [settings.diff])
  const tree = useMemo(() => treeChoices(settings.tree), [settings.tree])

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[40rem] flex-col pt-2">
      <Header snapshot={snapshot} />
      {/* Six pixels between panels, not twelve. Every gap here is width that
          could have been code, and the borders already do the separating —
          spacing on top of a border says the same thing twice. Two rather than
          six because the column to the left keeps four of its own, to stop its
          scrollbar landing on the card borders; the eye sees the sum, and the
          sum is the same six as between the cards. */}
      <div className="flex min-h-0 flex-1 items-stretch gap-0.5 pb-2">
        <About
          snapshot={snapshot}
          actions={actions}
          onOpenCommit={loadCommit === undefined ? undefined : setReading}
          onWarmCommit={loadCommit === undefined ? undefined : commits.warm}
          openedCommit={reading}
          notes={notes}
        />
        {reading === undefined || loadCommit === undefined ? (
          <FileBrowser
            files={snapshot.files}
            fetchDiffs={forThisHead}
            diff={diff}
            tree={tree}
            proseAsDocument={settings.diff.prose === "on"}
            menu={<SettingsMenu settings={settings} onChange={change} />}
          />
        ) : (
          <CommitView
            sha={reading}
            load={commits.ask}
            held={commits.held}
            onClose={() => setReading(undefined)}
            diff={diff}
            tree={tree}
            proseAsDocument={settings.diff.prose === "on"}
            menu={<SettingsMenu settings={settings} onChange={change} />}
          />
        )}
      </div>
    </div>
  )
}
