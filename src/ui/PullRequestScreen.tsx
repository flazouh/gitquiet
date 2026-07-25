import { useCallback, useEffect, useState } from "react"
import type { CourtOverride } from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { type PullRequestRef, toUrl } from "../domain/PullRequestRef"
import { Button } from "./button"
import { ControlCenter } from "./ControlCenter"

export type Loaded = {
  readonly snapshot: PullRequestSnapshot
  readonly overrides: ReadonlyArray<CourtOverride>
}

export type PullRequestScreenProps = {
  readonly reference: PullRequestRef
  readonly load: () => Promise<Loaded>
  readonly correct: (override: CourtOverride) => Promise<void>
  /**
   * Read from the page GitHub already rendered, so the Participant sees which
   * pull request they are on before the snapshot arrives.
   */
  readonly knownTitle?: string | undefined
}

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
  reference,
  load,
  correct,
  knownTitle
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
      <main className="flex flex-col gap-1 p-6">
        <p className="text-xs text-neutral-500">
          {reference.owner}/{reference.repo} #{reference.number}
        </p>
        {knownTitle === undefined ? null : (
          <h1 className="text-xl font-semibold text-neutral-900">{knownTitle}</h1>
        )}
        <p className="text-sm text-neutral-500">Working out what needs you…</p>
      </main>
    )
  }

  if (screen.status === "failed") {
    return (
      <main className="flex flex-col items-start gap-3 p-6">
        <h1 className="text-lg font-semibold text-neutral-900">
          Something GitHub sends has changed
        </h1>
        <p className="max-w-prose text-sm text-neutral-600">
          This pull request could not be read, so nothing is shown rather than part of it.
          GitHub's own page still works.
        </p>
        <Button asChild variant="outline">
          <a href={toUrl(reference)}>Open on GitHub</a>
        </Button>
      </main>
    )
  }

  return (
    <ControlCenter
      snapshot={screen.loaded.snapshot}
      overrides={screen.loaded.overrides}
      onCorrect={onCorrect}
    />
  )
}
