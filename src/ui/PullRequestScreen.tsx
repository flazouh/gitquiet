import { Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  LogLine,
  FetchedDiff,
  NewComment,
  PullRequestSnapshot,
  ReviewThread
} from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { MergeActions } from "./Sections"
import { Shell } from "./Shell"

export type Loaded = {
  readonly snapshot: PullRequestSnapshot
}

export type PullRequestScreenProps = {
  readonly reference: PullRequestRef
  readonly load: () => Promise<Loaded>
  /**
   * The pull request as it was last time, for the screen to show while
   * {@link load} finds out what it is now. Answers in about as long as a
   * storage read, so on any pull request read before there is nothing to wait
   * for and no loading message to show. Whatever it gives is replaced the
   * moment the live read lands.
   */
  readonly preload?: () => Promise<Option.Option<Loaded>>
  /** Content for a file the page arrived without, fetched when it is opened. */
  readonly fetchDiffs: (paths: ReadonlyArray<string>, head: string) => Promise<ReadonlyArray<FetchedDiff>>
  /** Restores GitHub's own conversation, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The same, but meant: hands the page back and remembers that GitHub's is the
   * page to open from now on. Kept apart from {@link onStepAside}, which is
   * what a failure does and must not be read as a preference.
   */
  readonly onUseGitHub?: () => void
  /** Merging and closing, which reach GitHub rather than the page. */
  readonly actions?: MergeActions
  /** Writes a remark on some lines to GitHub. */
  readonly postComment?: (note: NewComment) => Promise<ReviewThread>
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Promise<CommitDetail>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Promise<ReadonlyArray<CheckNote>>
  /** Reads one step's log, for the note in that dialog that points into it. */
  readonly loadLog?: (check: Check, step: number) => Promise<ReadonlyArray<LogLine>>
  /** Reads the end of a check's whole log, for a check no note points into. */
  readonly loadTail?: (check: Check, keep: number) => Promise<ReadonlyArray<LogLine>>
  /**
   * Holds GitHub's own socket open for the channels a pull request carries,
   * and says when one fires. Returns whatever stops it again.
   *
   * Passed in rather than opened here: a websocket is not something a screen
   * should know how to build, and a test that had to stand one up would be
   * testing the socket instead of the screen.
   */
  readonly watch?: (
    channels: ReadonlyArray<string>,
    onFire: () => void
  ) => () => void
  /**
   * Whether GitHub has anyone signed in, asked only when a read has failed.
   * Overridden in tests; in the browser it is the page's own answer.
   */
  readonly signedIn?: () => boolean
}

const WORKING = "Reading this pull request…"

/**
 * Who GitHub thinks is here, read off the page rather than asked for.
 *
 * Their own markup carries it on every page, signed in or out, so this costs
 * nothing and cannot itself fail — which matters, because the only time it is
 * asked is when everything else already has.
 */
const viewerOnPage = (): boolean =>
  (document.querySelector('meta[name="user-login"]')?.getAttribute("content") ?? "") !== ""

type Screen =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly loaded: Loaded }

export const PullRequestScreen = ({
  reference: _reference,
  load,
  preload,
  fetchDiffs,
  onStepAside,
  onUseGitHub,
  actions,
  postComment,
  loadCommit,
  loadNotes,
  loadLog,
  loadTail,
  watch,
  signedIn = viewerOnPage
}: PullRequestScreenProps) => {
  const [screen, setScreen] = useState<Screen>({ status: "loading" })

  // Whether this screen is still the one on the page. A re-read started by a
  // write can land after the reader has navigated away, and putting a snapshot
  // into a screen nobody is looking at is how a stale pull request appears
  // under a fresh one.
  const shown = useRef(true)
  useEffect(() => () => void (shown.current = false), [])

  /**
   * Reads the pull request again, after something of ours changed it.
   *
   * A failure is deliberately silent: what is on the screen is what GitHub
   * said a moment ago, and replacing a working page with an error because a
   * refresh missed would punish the reader for our own optimism.
   */
  const reread = useCallback(() => {
    load().then(
      (loaded) => {
        if (shown.current) setScreen({ status: "ready", loaded })
      },
      () => {}
    )
  }, [load])

  const acting = useMemo(
    () => (actions === undefined ? undefined : { ...actions, onChanged: reread }),
    [actions, reread]
  )

  useEffect(() => {
    let live = true
    // Whether GitHub has answered. What was remembered is only ever worth
    // showing before that, and the two are racing: on a fast connection, or a
    // pull request never read before, the live read wins and nothing
    // remembered is ever put on the screen.
    let answered = false

    preload?.().then((remembered) => {
      if (live && !answered && Option.isSome(remembered)) {
        setScreen({ status: "ready", loaded: remembered.value })
      }
    })

    load().then(
      (loaded) => {
        answered = true
        if (live) setScreen({ status: "ready", loaded })
      },
      () => {
        answered = true
        // A pull request already on the screen stays there. It is what GitHub
        // last said rather than what GitHub says now, which is worth less than
        // the truth and a great deal more than an error page — but the reader
        // is not yet told which of the two they are looking at.
        if (live) setScreen((shown) => (shown.status === "ready" ? shown : { status: "failed" }))
      }
    )
    return () => {
      live = false
    }
  }, [load, preload])

  const channels = screen.status === "ready" ? screen.loaded.snapshot.merge.channels : undefined

  useEffect(() => {
    if (watch === undefined || channels === undefined || channels.length === 0) return

    return watch(channels, reread)
    // Joined because the channels themselves are the identity: a re-read that
    // hands back the same tokens must not close and reopen the socket, and one
    // that hands back different tokens must.
  }, [watch, channels?.join(" "), reread])

  if (screen.status === "loading") {
    return (
      <p className="t-shimmer py-3 text-sm" data-text={WORKING}>
        {WORKING}
      </p>
    )
  }

  if (screen.status === "failed") {
    // Every route answers 404 to a signed-out reader on a private repository,
    // which looks exactly like a payload that changed shape. Blaming GitHub for
    // an expired session sends the reader looking for a bug in the wrong place,
    // when the fix is one link away.
    const out = !signedIn()

    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">
          {out ? "You are signed out of GitHub" : "Something GitHub sends has changed"}
        </h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {out
            ? "GitHub answers as if this pull request does not exist while nobody is signed in. Sign in and open it again."
            : "This pull request could not be read, so nothing is shown rather than part of it. GitHub's own conversation is still here."}
        </p>
        {out ? (
          <a
            className="btn btn-sm btn-primary mr-2"
            href={`https://github.com/login?return_to=${encodeURIComponent(location.href)}`}
          >
            Sign in to GitHub
          </a>
        ) : null}
        {/* Not a link back to the same page: their conversation was never
            removed, only hidden, so this is a button that gives it back. */}
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          Show GitHub's conversation
        </button>
      </div>
    )
  }

  return (
    <Shell
      snapshot={screen.loaded.snapshot}
      fetchDiffs={fetchDiffs}
      actions={acting}
      postComment={postComment}
      loadCommit={loadCommit}
      loadNotes={loadNotes}
      loadLog={loadLog}
      loadTail={loadTail}
      onUseGitHub={onUseGitHub}
    />
  )
}
