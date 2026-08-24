import { Effect, Option } from "effect"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FileRef,
  JobStep,
  NewComment,
  Remark,
  ReviewThread,
  LogLine,
  FetchedDiff,
  PullRequestSnapshot
} from "../domain/PullRequest"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import type { DiffSide } from "../ports/Renderer"
import { sizeOf } from "../domain/workingSet"
import { diffChoices, treeChoices } from "../domain/choices"
import { keyOf } from "../domain/PullRequestRef"
import { keptReads } from "../app/kept"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { CommitView } from "./CommitView"
import { FileBrowser } from "./FileBrowser"
import { Header } from "./Header"
import { About } from "./About"
import type { Answering } from "./ThreadView"
import { anchorSideOf } from "./threads"
import type { Review as Said } from "../ports/GitHubGateway"
import { Proposed } from "./Proposed"
import { logKey } from "./checkReads"
import type { MergeActions } from "./Ask"
import type { AskLayerSizes } from "./useLayerSizes"
import { KeyboardScope, useKeys } from "./useKeys"
import { useSettings } from "./useSettings"
import { whenIdle } from "../app/idle"

export type ShellProps = {
  readonly snapshot: PullRequestSnapshot
  /** Builds a detached route in smaller commits before it enters the route cache. */
  readonly preparing?: boolean
  /** Says when every prepared panel has committed to the detached root. */
  readonly onPrepared?: () => void
  readonly fetchDiffs: (
    paths: ReadonlyArray<string>,
    head: string
  ) => Effect.Effect<ReadonlyArray<FetchedDiff>, unknown>
  /** What the merge card can actually do, when anything is wired to it. */
  readonly actions?: MergeActions
  /** Writes a remark on some lines to GitHub, and hands back the thread it became. */
  readonly postComment?: (note: NewComment) => Effect.Effect<ReviewThread, unknown>
  /** Writes something about the pull request itself, which hangs on no line. */
  readonly postRemark?: (body: string) => Effect.Effect<Remark, unknown>
  /** Who can be mentioned and what can be referred to, for every box here. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  /** Marks one thread resolved, which is how a finding leaves the conversation. */
  readonly onSettle?: (threadId: string) => Effect.Effect<unknown, unknown>
  /** Opens a resolved thread again, from the foot of the thread itself. */
  readonly onUnsettle?: Answering["onUnsettle"]
  /** Answers inside a thread, and says what it holds afterwards. */
  readonly onReply?: Answering["onReply"]
  /** Says what this reader thinks of it, from the panel under the conversation. */
  readonly onReview?: (review: Said) => Effect.Effect<unknown, unknown>
  /**
   * Makes the stack GitHub offers, for the strip above the header that describes it.
   *
   * Its own prop rather than a ninth verb on {@link MergeActions}, for the reason
   * the proposal is not on the merge state: nothing about a press changes until
   * the stack exists. It belongs beside the two writes above it, which are also
   * things a reader does to a pull request from somewhere other than that card.
   */
  readonly makeStack?: () => Effect.Effect<void, unknown>
  /**
   * Counts the lines of the other layers of that proposal, one answer at a time.
   *
   * Beside the write above it and for the same reason: it belongs to the strip
   * rather than to the pull request this screen is about, and the layer the
   * reader is standing on is counted here for nothing.
   */
  readonly layerSizes?: AskLayerSizes
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Effect.Effect<CommitDetail, unknown>
  /** Content for a file that commit arrived without, which is most of them. */
  readonly fetchCommitDiffs?: (
    sha: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<FetchedDiff>, unknown>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Effect.Effect<ReadonlyArray<CheckNote>, unknown>
  /** Reads one step's log, for the note in that dialog that points into it. */
  readonly loadLog?: (
    check: Check,
    step: number
  ) => Effect.Effect<ReadonlyArray<LogLine>, unknown>
  /** Reads the end of a check's whole log, for a check no note points into. */
  readonly loadTail?: (
    check: Check,
    keep: number
  ) => Effect.Effect<ReadonlyArray<LogLine>, unknown>
  /** Reads the steps a check ran as, which is what its dialog opens as. */
  readonly loadSteps?: (check: Check) => Effect.Effect<ReadonlyArray<JobStep>, unknown>
  /** Whose keys these are. One day a setting; for now, the standard set. */
  readonly keys?: Profile
  /** Gives the page back to GitHub, and remembers to keep giving it back. */
  readonly onUseGitHub?: () => void
}

const NO_READER = new Error("Nothing is wired to read commits.")

/**
 * The last stage that builds anything, and where an arrival stops counting.
 *
 * The panels take stages 1 to 13 and the file browser 15 to 18. A stage past
 * the last gate is an idle callback that renders the whole prepared screen to
 * add no element to it, and the screen only reports itself ready to be cached
 * once the count is spent — so a ceiling left above the gates is a page that
 * says it is ready several callbacks after it was.
 */
const PREPARED = 18

/**
 * How long an arrival may keep entering, in milliseconds.
 *
 * Past the last panel's stagger and its travel — five staggers of forty and a
 * quarter second of entrance is under half a second — so nothing is cut off
 * mid-arrival, and early enough that the first late read to land finds the
 * page already still.
 */
const LANDING = 700

/**
 * The one command that belongs to the page rather than to a panel in it.
 *
 * A component of its own, rendered inside the scope, because a component cannot
 * see the context it provides itself: asked from the page's own body, the
 * keyboard would be looking at all of GitHub's markup for what the reader has
 * open, and find one of their thirty dropdowns every time.
 */
const PageKeys = ({
  keys,
  onDismiss
}: {
  readonly keys: Profile
  readonly onDismiss: () => void
}) => {
  useKeys(keys, { dismiss: onDismiss })
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
  preparing = false,
  onPrepared,
  fetchDiffs,
  actions,
  postComment,
  postRemark,
  suggest,
  onUpload,
  onSettle,
  onUnsettle,
  onReply,
  onReview,
  makeStack,
  layerSizes,
  loadCommit,
  fetchCommitDiffs,
  loadNotes,
  loadLog,
  loadTail,
  loadSteps,
  keys = DEFAULT_PROFILE,
  onUseGitHub
}: ShellProps) => {
  const [preparedStage, setPreparedStage] = useState(preparing ? 0 : PREPARED)
  const preparationReported = useRef(false)

  useEffect(() => {
    if (!preparing || preparedStage >= PREPARED) return
    return whenIdle(() => setPreparedStage((stage) => Math.min(stage + 1, PREPARED)))
  }, [preparing, preparedStage])

  useEffect(() => {
    if (!preparing || preparedStage < PREPARED || preparationReported.current) return
    preparationReported.current = true
    onPrepared?.()
  }, [onPrepared, preparing, preparedStage])

  // Which commit is being read, if any. The rail does not change when one is —
  // the pull request is still the thing being reviewed, and a commit is a way
  // of looking at part of it.
  const [reading, setReading] = useState<string | undefined>(undefined)
  // Review Mode changes the file browser's box, not the browser itself. Its
  // file, scroll position, warmed diffs, and drafts therefore stay in place.
  const [reviewing, setReviewing] = useState(false)

  // A sha names something that cannot change, so every commit is read once and
  // kept: opening one a second time, or after a pointer warmed it on the way
  // past, costs nothing.
  const commits = useMemo(
    () => keptReads<string, CommitDetail>((sha) => loadCommit?.(sha) ?? Effect.fail(NO_READER)),
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
              ? Effect.succeed([])
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
              ? Effect.succeed([])
              : loadTail(check, all ? Number.MAX_SAFE_INTEGER : 200)
          }),
    [loadTail]
  )
  // Held by check name. A finished job's steps are as settled as its log is, and
  // the same dialog opened twice asks once.
  const steps = useMemo(
    () =>
      loadSteps === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<JobStep>>((name) => {
            const check = latest.current.find((one) => one.name === name)
            return check === undefined ? Effect.succeed([]) : loadSteps(check)
          }),
    [loadSteps]
  )
  const notes = useMemo(
    () =>
      loadNotes === undefined
        ? undefined
        : keptReads<string, ReadonlyArray<CheckNote>>((name) => {
            const check = latest.current.find((one) => one.name === name)
            if (check === undefined) return Effect.succeed([])

            return Effect.map(loadNotes(check), (found) => {
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

  /*
   * The same for a remark, and for the same reason: what the reader just said has
   * to appear where they said it, and re-reading the whole page to find one comment
   * they already have in their hand is a second of nothing happening.
   */
  const [said, setSaid] = useState<ReadonlyArray<Remark>>([])
  const remarks = useMemo(() => [...snapshot.remarks, ...said], [snapshot.remarks, said])

  const onSay = useMemo(
    () =>
      postRemark === undefined
        ? undefined
        : (body: string) =>
            Effect.map(postRemark(body), (remark) => setSaid((held) => [...held, remark])),
    [postRemark]
  )

  const onPost = useMemo(
    () =>
      postComment === undefined
        ? undefined
        : (note: {
            readonly path: string
            readonly side: DiffSide
            readonly from: number
            readonly to: number
            readonly body: string
          }) =>
            Effect.map(
              postComment({
                path: note.path,
                // The half of the diff the lines were marked on, which is the
                // file their numbers belong to. A remark on a removed line
                // carried over to the new file is a remark on whichever line
                // the change happened to leave at that number.
                side: anchorSideOf(note.side),
                line: note.to,
                startLine: note.from,
                body: note.body,
                baseSha: snapshot.baseSha,
                headSha: snapshot.headSha
              }),
              (thread) => setPosted((held) => [...held, thread])
            ),
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
  // The same for the commit being read, whose held-back files are its own
  // rather than the branch's: a file at this sha is not the file at the head.
  const forThisCommit = useCallback(
    (paths: ReadonlyArray<string>) =>
      reading === undefined || fetchCommitDiffs === undefined
        ? Effect.succeed([])
        : fetchCommitDiffs(reading, paths),
    [fetchCommitDiffs, reading]
  )

  // Held rather than written at the call site, because the drawing under it is
  // memoised: a fresh object here is a new prop on every render of this screen,
  // and the whole point of that `memo` is that a press somewhere else does not
  // draw the diff again.
  const answering = useMemo(
    () => ({ viewer, suggest, onUpload, onReply, onSettle, onUnsettle }),
    [viewer, suggest, onUpload, onReply, onSettle, onUnsettle]
  )

  // Read once here and handed down as two settled objects: the diff and the
  // rail should never be looking at different answers to the same question.
  //
  // The way in is in two places, and they are two errands. The bar carries the
  // sheet, which is where the knobs are read about and where a screen with no
  // files band reaches them at all. The band above the diff carries the same
  // knobs as a menu, because a diff drawn the wrong way is answered above the
  // diff rather than at the top of the page. Writing goes through this one
  // reader either way, so nothing on the screen holds a second copy.
  const { settings, change } = useSettings()
  // The menu answers on the click; the diff follows. Redrawing every open file
  // is hundreds of milliseconds of main thread, and doing it in the click's own
  // task froze the menu mid-close. Deferred, the tick and the close paint first
  // and the redraw runs behind them, interruptible by the next input.
  const settled = useDeferredValue(settings)
  const diff = useMemo(() => diffChoices(settled.diff), [settled.diff])
  const tree = useMemo(() => treeChoices(settled.tree), [settled.tree])

  // Every dialog and menu of ours is drawn inside this, and the keyboard asks
  // it — rather than the page — what the reader has open.
  const [ours, setOurs] = useState<HTMLElement | null>(null)

  /*
   * Whether the page has finished arriving, for the stylesheet.
   *
   * The entrance animations belong to the arrival, and only to it. A snapshot
   * that completes later inserts panels above settled ones; React moves the
   * neighbours by re-inserting them, and a re-inserted element replays its CSS
   * animation — the whole column entered twice on a prefetched pull request.
   * Once this flag is on, `motion.css` takes the entrance off everything under
   * it: a late panel simply is there, which is what the sheet already promises
   * about answers. The delay is the entrance's own length — the longest stagger
   * plus the travel — with a beat to spare.
   */
  const [landed, setLanded] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLanded(true), LANDING)
    return () => clearTimeout(timer)
  }, [])

  return (
    <KeyboardScope value={ours}>
      <div ref={setOurs} data-gitquiet-landed={landed ? "" : undefined} className="flex flex-col pt-2">
        <PageKeys keys={keys} onDismiss={() => setReading(undefined)} />
        {/* Above the header, where GitHub's banner about the same thing stands.
            It is drawn at all only where they offer a stack and nobody has made
            one, so every ordinary pull request and every layer of a real stack
            opens on the header it opened on before. See `Proposed`. */}
        {preparedStage >= 1 && Option.isSome(snapshot.proposal) ? (
          <Proposed
            chain={snapshot.proposal.value}
            make={makeStack}
            sizes={layerSizes}
            own={sizeOf(snapshot.files)}
          />
        ) : null}
        {preparedStage >= 2 ? (
          <Header snapshot={snapshot} onUseGitHub={onUseGitHub} />
        ) : null}
        {/* Six pixels between panels, not twelve. Every gap here is width that
            could have been code, and the borders already do the separating —
            spacing on top of a border says the same thing twice.

            Aligned to the top rather than stretched: the column to the left is
            as tall as what the author wrote and the reviewers said, which is
            nobody's business but its own. */}
        <div className="flex items-start gap-1.5 pb-2">
          {preparedStage >= 3 ? (
            <About
              snapshot={snapshot}
              prepareThrough={Math.min(preparedStage - 2, 11)}
              actions={actions}
              onOpenCommit={loadCommit === undefined ? undefined : setReading}
              onWarmCommit={loadCommit === undefined ? undefined : commits.warm}
              openedCommit={reading}
              notes={notes}
              logs={logs}
              tails={tails}
              steps={steps}
              reach={reach}
              viewer={viewer}
              onSay={onSay}
              onSettle={onSettle}
              onUnsettle={onUnsettle}
              onReply={onReply}
              onReview={onReview}
              suggest={suggest}
              onUpload={onUpload}
              remarks={remarks}
            />
          ) : null}
          {/* The code stays where it is while the page scrolls past it. A diff
              is read in place — the tree, the file being read and the way to the
              next one all have to stay under the pointer — so this is the one
              part of the page that keeps a height and scrolls inside it. Pinned
              rather than fixed: where a browser or GitHub's own layout will not
              have it, it simply sits still and the page scrolls as one. */}
          {/* Below the bar, not under it: the bar floats over the top of the
              viewport on its own sticky, and it says how tall it is through
              `--gitquiet-bar-h` — see `TheBar.tsx`. Zero where there is no bar,
              which is the desktop window and a test. */}
          {preparedStage >= 15 ? (
            <div
              data-gitquiet-activation="files-panel"
              className="sticky top-[calc(var(--gitquiet-bar-h,0px)+0.5rem)] flex h-[calc(100vh-var(--gitquiet-bar-h,0px)-1rem)] min-h-[40rem] min-w-0 flex-1"
            >
              {reading === undefined || loadCommit === undefined ? (
                <FileBrowser
                  files={snapshot.files}
                  prepareThrough={Math.min(preparedStage - 15, 3)}
                  fetchDiffs={forThisHead}
                  diff={diff}
                  tree={tree}
                  proseAsDocument={settled.diff.prose === "on"}
                  keys={keys}
                  wanted={wanted}
                  threads={threads}
                  viewer={viewer}
                  onPost={onPost}
                  suggest={suggest}
                  onUpload={onUpload}
                  answering={answering}
                  review={{
                    active: reviewing,
                    subject: keyOf(snapshot.reference),
                    head: snapshot.headSha,
                    onChange: setReviewing
                  }}
                  display={{ settings, onChange: change }}
                />
              ) : (
                <CommitView
                  sha={reading}
                  load={commits.ask}
                  held={commits.held}
                  onClose={() => setReading(undefined)}
                  fetchDiffs={forThisCommit}
                  diff={diff}
                  tree={tree}
                  proseAsDocument={settled.diff.prose === "on"}
                  keys={keys}
                  display={{ settings, onChange: change }}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </KeyboardScope>
  )
}
