import { useCallback, useEffect, useState } from "react"
import type { CourtOverride } from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { ControlCenter } from "./ControlCenter"
import { Conversation } from "./Conversation"
import { FilesView } from "./FilesView"
import { kindArt } from "./Icon"
import { Tabs } from "./Tabs"

export type Loaded = {
  readonly snapshot: PullRequestSnapshot
  readonly overrides: ReadonlyArray<CourtOverride>
}

export type PullRequestScreenProps = {
  readonly reference: PullRequestRef
  readonly load: () => Promise<Loaded>
  readonly correct: (override: CourtOverride) => Promise<void>
  /** Restores GitHub's own conversation, which is still on the page behind this. */
  readonly onStepAside: () => void
}

const WORKING = "Working out what needs you…"

type Screen =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly loaded: Loaded }

const replacing = (
  overrides: ReadonlyArray<CourtOverride>,
  override: CourtOverride
): ReadonlyArray<CourtOverride> => [
  ...overrides.filter((entry) => entry.itemId !== override.itemId),
  override
]

export const PullRequestScreen = ({
  reference: _reference,
  load,
  correct,
  onStepAside
}: PullRequestScreenProps) => {
  const [screen, setScreen] = useState<Screen>({ status: "loading" })

  useEffect(() => {
    let live = true
    load().then(
      (loaded) => {
        if (live) setScreen({ status: "ready", loaded })
      },
      () => {
        if (live) setScreen({ status: "failed" })
      }
    )
    return () => {
      live = false
    }
  }, [load])

  // Shown immediately so a correction never waits on the store.
  const onCorrect = useCallback(
    (override: CourtOverride) => {
      setScreen((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              loaded: {
                snapshot: current.loaded.snapshot,
                overrides: replacing(current.loaded.overrides, override)
              }
            }
          : current
      )
      void correct(override)
    },
    [correct]
  )

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

  const { snapshot, overrides } = screen.loaded

  return (
    <Tabs
      label="This pull request"
      views={[
        {
          name: "Overview",
          art: kindArt.review,
          panel: () => (
            <ControlCenter snapshot={snapshot} overrides={overrides} onCorrect={onCorrect} />
          )
        },
        {
          name: "Files",
          art: kindArt.file,
          count: snapshot.files.length,
          panel: () => <FilesView files={snapshot.files} />
        },
        {
          name: "Conversation",
          art: kindArt.thread,
          count: snapshot.threads.length,
          panel: () => <Conversation threads={snapshot.threads} />
        }
      ]}
    />
  )
}
