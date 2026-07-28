import { Option } from "effect"
import { useCallback, useMemo, useRef, useState } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FileRef,
  NewComment,
  ReviewThread,
  LogLine,
  FetchedDiff,
  PullRequestSnapshot
} from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../settings/apply"
import { keptReads } from "../app/kept"
import { chordFor, DEFAULT_PROFILE, type Chord, type Profile } from "../keys/commands"
import { CommitView } from "./CommitView"
import { FileBrowser } from "./FileBrowser"
import { Header } from "./Header"
import { KeySheet } from "./KeySheet"
import { About, logKey, type MergeActions } from "./Sections"
import { SettingsMenu } from "./SettingsMenu"
import { KeyboardScope, useKeys } from "./useKeys"
import { useSettings } from "./useSettings"

export type ShellProps = {
  readonly snapshot: PullRequestSnapshot
  readonly fetchDiffs: (paths: ReadonlyArray<string>, head: string) => Promise<ReadonlyArray<FetchedDiff>>
  /** What the merge card can actually do, when anything is wired to it. */
  readonly actions?: MergeActions
  /** Writes a remark on some lines to GitHub, and hands back the thread it became. */
  readonly postComment?: (note: NewComment) => Promise<ReviewThread>
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Promise<CommitDetail>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Promise<ReadonlyArray<CheckNote>>
  /** Reads one step's log, for the note in that dialog that points into it. */
  readonly loadLog?: (check: Check, step: number) => Promise<ReadonlyArray<LogLine>>
  /** Reads the end of a check's whole log, for a check no note points into. */
  readonly loadTail?: (check: Check, keep: number) => Promise<ReadonlyArray<LogLine>>
  /** Whose keys these are. One day a setting; for now, the standard set. */
  readonly keys?: Profile
  /** Gives the page back to GitHub, and remembers to keep giving it back. */
  readonly onUseGitHub?: () => void
}

const NO_READER = new Error("Nothing is wired to read commits.")

/**
 * The way into the shortcut sheet for someone who does not yet know the key
 * that opens it, which is everyone the first time.
 *
 * Drawn as the key rather than as a button with a label: it says what to press
 * next time in the act of being clicked this time, and it is the only thing on
 * the row that can afford one character.
 */
const HelpKey = ({ chord, onOpen }: { readonly chord: Chord; readonly onOpen: () => void }) => (
  <button
    type="button"
    aria-label="Keyboard shortcuts"
    aria-keyshortcuts={chord}
    onClick={onOpen}
    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface font-mono text-xs text-ink-muted hover:text-ink"
  >
    {chord}
  </button>
)

/**
 * The two commands that belong to the page rather than to a panel in it.
 *
 * A component of its own, rendered inside the scope, because a component cannot
 * see the context it provides itself: asked from the page's own body, the
 * keyboard would be looking at all of GitHub's markup for what the reader has
 * open, and find one of their thirty dropdowns every time.
 */
const PageKeys = ({
  keys,
  onHelp,
  onDismiss
}: {
  readonly keys: Profile
  readonly onHelp: () => void
  readonly onDismiss: () => void
}) => {
  useKeys(keys, { help: onHelp, dismiss: onDismiss })
  return null
}

/**
 * The page: what this pull request is, beside what it changes.
 *
 * Two columns rather than tabs, because reading a diff and reading the reason
 * for it are the same act, and a tab makes you choose one. The left column is as
 * tall as it needs to be — description, CI, conversation, commits, merge, in the
 * order anyone asks about them — and scrolls with the page rather than inside a
 * box of its own. The right is the code, taking whatever width is left and
 * staying put while the page moves past it.
 */
export const Shell = ({
  snapshot,
  fetchDiffs,
  actions,
  postComment,
  loadCommit,
  loadNotes,
  loadLog,
  loadTail,
  keys = DEFAULT_PROFILE,
  onUseGitHub
}: ShellProps) => {
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
  // Held under "check name:step", the one spelling both sides agree on. A
  // step's log is a few kilobytes and cannot change once the step has ended,
  // so it is read once however many times the dialog is opened.
  const logs = useMemo(
    () =>
      loadLog === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<LogLine>>((key) => {
            const cut = key.lastIndexOf(":")
            const check = latest.current.find((one) => one.name === key.slice(0, cut))
            return check === undefined
              ? Promise.resolve([])
              : loadLog(check, Number(key.slice(cut + 1)))
          }),
    [loadLog]
  )
  // Two hundred lines: enough to hold a stack trace and the step that led to
  // it, short of the thousands a green job spends installing things.
  const tails = useMemo(
    () =>
      loadTail === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<LogLine>>((key) => {
            // "name:whole" is the same log read without a limit, held apart
            // from the tail so that asking for all of it does not throw away
            // the part already in hand.
            const all = key.endsWith(":whole")
            const check = latest.current.find(
              (one) => one.name === (all ? key.slice(0, -":whole".length) : key)
            )
            return check === undefined
              ? Promise.resolve([])
              : loadTail(check, all ? Number.MAX_SAFE_INTEGER : 200)
          }),
    [loadTail]
  )
  const notes = useMemo(
    () =>
      loadNotes === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<CheckNote>>((name) => {
            const check = latest.current.find((one) => one.name === name)
            if (check === undefined) return Promise.resolve([])

            return loadNotes(check).then((found) => {
              // A note names the step its log is in, which is only known once
              // the note is here. Warming from inside the read means a pointer
              // that passed over the row has fetched both by the time it is
              // clicked, rather than the log starting when the dialog opens.
              for (const one of found) {
                if (Option.isSome(one.at)) logs?.warm(logKey(check, one.at.value.step))
              }
              return found
            })
          }),
    [loadNotes, logs]
  )
  // Remarks written in this sitting. GitHub's own page data is fetched once,
  // so a comment posted a moment ago is only in the interface because it was
  // put here — and putting it here beats reading the whole page again.
  const [posted, setPosted] = useState<ReadonlyArray<ReviewThread>>([])
  const threads = useMemo(
    () => [...snapshot.threads, ...posted],
    [snapshot.threads, posted]
  )

  const onPost = useMemo(
    () =>
      postComment === undefined
        ? undefined
        : async (note: {
            readonly path: string
            readonly from: number
            readonly to: number
            readonly body: string
          }) => {
            const thread = await postComment({
              path: note.path,
              line: note.to,
              startLine: note.from,
              body: note.body,
              baseSha: snapshot.baseSha,
              headSha: snapshot.headSha
            })
            setPosted((held) => [...held, thread])
          },
    [postComment, snapshot.baseSha, snapshot.headSha]
  )

  // The face beside the box is the reader's own, which GitHub serves under
  // their login. Their avatar arrives with the comment once it is posted.
  const viewer = useMemo(
    () => ({
      login: snapshot.viewer.login,
      faceUrl: `https://github.com/${snapshot.viewer.login}.png?size=48`
    }),
    [snapshot.viewer.login]
  )

  // A file named in a failing log. Held as an object so that clicking the same
  // line twice still counts as asking for it twice — a reader who has since
  // wandered off to another file means it both times.
  const [wanted, setWanted] = useState<{ readonly path: string } | undefined>(undefined)
  const reach = useMemo(
    () => ({
      paths: snapshot.files.map((file) => file.path),
      onOpenFile: (path: string) => {
        // Back to the files first: a commit may be open, and the file the log
        // named belongs to the pull request rather than to that commit.
        setReading(undefined)
        setWanted({ path })
      },
      hrefFor: (ref: FileRef) =>
        `https://github.com/${snapshot.reference.owner}/${snapshot.reference.repo}/blob/${snapshot.headSha}/${ref.path}#L${ref.line}`
    }),
    [snapshot.files, snapshot.headSha, snapshot.reference.owner, snapshot.reference.repo]
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

  // The way out closes the nearest thing that is open, innermost first, which
  // is the only order anyone expects Escape to work in.
  const [helping, setHelping] = useState(false)

  // The settings and the way into the sheet travel together: both belong to the
  // right end of the files header, and neither panel should have to know that.
  // Every dialog and menu of ours is drawn inside this, and the keyboard asks
  // it — rather than the page — what the reader has open.
  const [ours, setOurs] = useState<HTMLElement | null>(null)

  const askKey = chordFor(keys, "help")
  const corner = (
    <>
      {askKey === null ? null : <HelpKey chord={askKey} onOpen={() => setHelping(true)} />}
      <SettingsMenu settings={settings} onChange={change} />
    </>
  )

  return (
    <KeyboardScope value={ours}>
      <div ref={setOurs} className="flex flex-col pt-2">
        <PageKeys
          keys={keys}
          onHelp={() => setHelping((shown) => !shown)}
          onDismiss={() => {
            if (helping) setHelping(false)
            else setReading(undefined)
          }}
        />
        <Header snapshot={snapshot} onUseGitHub={onUseGitHub} />
        {/* Six pixels between panels, not twelve. Every gap here is width that
            could have been code, and the borders already do the separating —
            spacing on top of a border says the same thing twice.

            Aligned to the top rather than stretched: the column to the left is
            as tall as what the author wrote and the reviewers said, which is
            nobody's business but its own. */}
        <div className="flex items-start gap-1.5 pb-2">
          <About
            snapshot={snapshot}
            actions={actions}
            onOpenCommit={loadCommit === undefined ? undefined : setReading}
            onWarmCommit={loadCommit === undefined ? undefined : commits.warm}
            openedCommit={reading}
            notes={notes}
            logs={logs}
            tails={tails}
            reach={reach}
          />
          {/* The code stays where it is while the page scrolls past it. A diff
              is read in place — the tree, the file being read and the way to the
              next one all have to stay under the pointer — so this is the one
              part of the page that keeps a height and scrolls inside it. Pinned
              rather than fixed: where a browser or GitHub's own layout will not
              have it, it simply sits still and the page scrolls as one. */}
          <div className="sticky top-2 flex h-[calc(100vh-1rem)] min-h-[40rem] min-w-0 flex-1">
            {reading === undefined || loadCommit === undefined ? (
              <FileBrowser
                files={snapshot.files}
                fetchDiffs={forThisHead}
                diff={diff}
                tree={tree}
                proseAsDocument={settings.diff.prose === "on"}
                keys={keys}
                wanted={wanted}
                threads={threads}
                viewer={viewer}
                onPost={onPost}
                menu={corner}
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
                keys={keys}
                menu={corner}
              />
            )}
          </div>
        </div>
        {helping ? (
          <KeySheet
            profile={keys}
            unbound={tree.search ? undefined : ["search"]}
            onClose={() => setHelping(false)}
          />
        ) : null}
      </div>
    </KeyboardScope>
  )
}
