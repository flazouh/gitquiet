import { Option } from "effect"
import { useEffect, useState } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FetchedDiff,
  PullRequestSnapshot
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
  /** Merging and closing, which reach GitHub rather than the page. */
  readonly actions?: MergeActions
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Promise<CommitDetail>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Promise<ReadonlyArray<CheckNote>>
}

const WORKING = "Reading this pull request…"

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
  actions,
  loadCommit,
  loadNotes
}: PullRequestScreenProps) => {
  const [screen, setScreen] = useState<Screen>({ status: "loading" })

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

  if (screen.status === "loading") {
    return (
      <p className="t-shimmer py-3 text-sm" data-text={WORKING}>
        {WORKING}
      </p>
    )
  }

  if (screen.status === "failed") {
    return (
      <div className="Box p-4">
        <h2 className="mb-1 text-base font-semibold">Something GitHub sends has changed</h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          This pull request could not be read, so nothing is shown rather than part of it. GitHub's
          own conversation is still here.
        </p>
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
      actions={actions}
      loadCommit={loadCommit}
      loadNotes={loadNotes}
    />
  )
}
