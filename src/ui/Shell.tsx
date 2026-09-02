import { Effect, Option } from "effect"
import { beyond } from "./beyond"
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
import { quoting } from "../domain/fileAt"
import { keptReads } from "../app/kept"
import { hasLandedBefore, LANDING, markLanded } from "./landing"
import { revealer } from "../app/revealing"
import type { Keys } from "../keys/commands"
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
import { addressOf, type LookingAt, lookingAt } from "../domain/lookingAt"
import { keysOf } from "../app/keyboard"
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
  /**
   * One whole file at one commit, for revealing the lines between the hunks.
   *
   * Handed in as a read rather than as a Revealer because which two commits a
   * file is revealed between belongs to the snapshot, which is this component's
   * to know. See `src/app/revealing.ts`.
   */
  readonly readWholeFile?: (sha: string, path: string) => Effect.Effect<string, unknown>
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
  /**
   * Whose keys these are, where a caller has an opinion.
   *
   * Almost nothing does: the reader's own answer is in the settings this
   * component already reads, and handing one in overrides it. It stays a prop
   * for the onboarding and for a test, both of which draw this screen against
   * fixtures rather than against whatever is in storage.
   */
  readonly keys?: Keys
  /** Gives the page back to GitHub, and remembers to keep giving it back. */
  readonly onUseGitHub?: () => void
}

const NO_READER = new Error("Nothing is wired to read commits.")

/**
 * The last stage that builds anything, and where an arrival stops counting.
 *
 * The panels take stages 1 to 13 and the file browser 14 to 17. A stage past
 * the last gate is an idle callback that renders the whole prepared screen to
 * add no element to it, and the screen only reports itself ready to be cached
 * once the count is spent — so a ceiling left above the gates is a page that
 * says it is ready several callbacks after it was.
 */
const PREPARED = 17


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
  readonly keys: Keys
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
  readWholeFile,
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
  keys,
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
    () => [...snapshot.threads, ...beyond(snapshot.threads, posted)],
    [snapshot.threads, posted]
  )

  /*
   * The same for a remark, and for the same reason: what the reader just said has
   * to appear where they said it, and re-reading the whole page to find one comment
   * they already have in their hand is a second of nothing happening.
   */
  const [said, setSaid] = useState<ReadonlyArray<Remark>>([])
  const remarks = useMemo(
    () => [...snapshot.remarks, ...beyond(snapshot.remarks, said)],
    [snapshot.remarks, said]
  )

  const onSay = useMemo(
    () =>
      postRemark === undefined
        ? undefined
        : (body: string) =>
            Effect.map(postRemark(body), (remark) => setSaid((held) => [...held, remark])),
    [postRemark]
  )

  /*
   * The way to reveal the lines GitHub left out of every file in this diff.
   *
   * Built here because it is keyed by this pull request's own two commits, and
   * a file kept under the wrong pair is a file from another comparison. Only
   * the pull request's own browser is given one: a commit read inside this page
   * is a different comparison, between that commit and its parent, and the same
   * revealer there would reveal the wrong halves.
   */
  const revealing = useMemo(
    () =>
      readWholeFile === undefined
        ? undefined
        : revealer(readWholeFile, { base: snapshot.baseSha, head: snapshot.headSha }),
    [readWholeFile, snapshot.baseSha, snapshot.headSha]
  )

  const onPost = useMemo(
    () =>
      postComment === undefined
        ? undefined
        : (note: {
            readonly path: string
            readonly lines?: {
              readonly side: DiffSide
              readonly from: number
              readonly to: number
            }
            readonly body: string
          }) =>
            Effect.map(
              postComment({
                path: note.path,
                // Absent on a File Remark, which is about the file rather than
                // any line of it. Where there are lines, the half of the diff
                // they were marked on is the file their numbers belong to: a
                // remark on a removed line carried over to the new file is a
                // remark on whichever line the change happened to leave there.
                lines:
                  note.lines === undefined
                    ? null
                    : {
                        side: anchorSideOf(note.lines.side),
                        line: note.lines.to,
                        startLine: note.lines.from
                      },
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

  /*
   * A file named in a failing log, or in the address this page was opened at.
   *
   * Held as an object so that clicking the same line twice still counts as
   * asking for it twice — a reader who has since wandered off to another file
   * means it both times.
   *
   * The address is read as this is first rendered rather than in an effect,
   * because by the time an effect of this component runs the address is already
   * ours: the file browser is a child, a child's effects run before its
   * parent's, and the first thing it does is say which file is open. Read a
   * moment later, this component was reading its own handwriting and a reader
   * arriving on a link to the ninth file was shown the first.
   *
   * The file is not checked against the snapshot here. A page can be drawn from
   * a partly-read snapshot, so a file this names may simply not have arrived
   * yet, and the browser is already the thing that waits for it — a path it
   * cannot find is a path it ignores until the files change under it.
   *
   * The fragment on a pull request is usually GitHub's — a comment, a heading in
   * the description, one of their own file anchors — and `lookingAt` answers
   * nothing to all of those, so nothing is opened that the reader did not name.
   */
  const [wanted, setWanted] = useState<
    { readonly path: string; readonly line?: number } | undefined
  >(() => {
    const at = lookingAt(window.location.hash)
    if (at === null) return undefined
    // The first of a run. A reader who sent a link to lines 42 to 48 was
    // pointing at what starts on 42, and putting the middle of the run in the
    // centre of the screen would be answering a question nobody asked.
    return { path: at.path, line: at.lines?.from }
  })

  /*
   * Where the reader is, written into the address as they go.
   *
   * Replaced rather than pushed: walking forty files is forty presses, and a
   * history entry for each would make Back a way of undoing a review one file at
   * a time instead of a way out of the page. The address is still a real address
   * — copy it, send it, open it in another tab, and the same file opens with the
   * same lines named.
   *
   * Only the pull request's own files write it. A commit's files are drawn by
   * the same component inside this page, and a fragment naming one of those
   * would be read back on arrival as a file of the pull request.
   */
  const onReading = useCallback((at: LookingAt) => {
    const fragment = addressOf(at)
    if (fragment === "" || fragment === window.location.hash) return

    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${fragment}`
    )
  }, [])
  const reach = useMemo(
    () => ({
      paths: snapshot.files.map((file) => file.path),
      onOpenFile: (path: string) => {
        // Back to the files first: a commit may be open, and the file the log
        // named belongs to the pull request rather than to that commit.
        setReading(undefined)
        setWanted({ path })
      },
      // The same address a remark quotes a file into, built in the one place
      // that knows how. See `domain/fileAt.ts`.
      hrefFor: (ref: FileRef) =>
        quoting(
          {
            owner: snapshot.reference.owner,
            repo: snapshot.reference.repo,
            on: snapshot.headSha,
            path: ref.path
          },
          { from: ref.line, to: ref.line }
        )
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
  /*
   * The keyboard the reader chose, held rather than made on each render: it is a
   * value now rather than a word, and `useKeys` takes its listener off the
   * document and puts it back whenever the profile changes.
   *
   * Off the settled copy for the same reason the diff and the rail are: a change
   * made in the panel paints the tick and closes before the screen behind it
   * redraws. Read here rather than handed in, because a reader who chose vim in
   * one tab meant it in the one they were already looking at.
   */
  const chosenKeys = useMemo(() => keysOf(settled), [settled])
  const keying = keys ?? chosenKeys

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
  const [landed, setLanded] = useState(() => hasLandedBefore(document))
  useEffect(() => {
    if (landed) return
    const timer = setTimeout(() => {
      // On the document as well as in this state, so that the screen replacing
      // this one starts landed rather than entering all over again. See
      // `hasLandedBefore`.
      markLanded(document)
      setLanded(true)
    }, LANDING)
    return () => clearTimeout(timer)
  }, [landed])

  return (
    <KeyboardScope value={ours}>
      <div ref={setOurs} data-gitquiet-landed={landed ? "" : undefined} className="flex flex-col pt-2">
        <PageKeys keys={keying} onDismiss={() => setReading(undefined)} />
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
          {preparedStage >= 14 ? (
            <div
              data-gitquiet-activation="files-panel"
              className="sticky top-[calc(var(--gitquiet-bar-h,0px)+0.5rem)] flex h-[calc(100vh-var(--gitquiet-bar-h,0px)-1rem)] min-h-[40rem] min-w-0 flex-1"
            >
              {reading === undefined || loadCommit === undefined ? (
                <FileBrowser
                  files={snapshot.files}
                  prepareThrough={Math.min(preparedStage - 14, 3)}
                  fetchDiffs={forThisHead}
                  diff={diff}
                  tree={tree}
                  proseAsDocument={settled.diff.prose === "on"}
                  keys={keying}
                  wanted={wanted}
                  threads={threads}
                  viewer={viewer}
                  onPost={onPost}
                  suggest={suggest}
                  onUpload={onUpload}
                  revealing={revealing}
                  answering={answering}
                  review={{
                    active: reviewing,
                    subject: keyOf(snapshot.reference),
                    head: snapshot.headSha,
                    onChange: setReviewing
                  }}
                  onReading={onReading}
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
                  keys={keying}
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
