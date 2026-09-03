import type { Effect, Option } from "effect"
import type { DiscussionRef, DiscussionSnapshot } from "../domain/discussions"
import type { Repository } from "../domain/repositories"
import { Discussion } from "./Discussion"
import { DrawnAt } from "./drawnAt"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type DiscussionScreenProps = {
  readonly reference: DiscussionRef
  readonly load: (partly: (shown: DiscussionSnapshot) => void) => Effect.Effect<
    DiscussionSnapshot,
    unknown
  >
  /** The discussion as the last visit left it, painted while the live read is in the air. */
  readonly preload?: () => Effect.Effect<Option.Option<DiscussionSnapshot>>
  /** Restores GitHub's own page, which is still behind this. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string
}

const READING = "Reading this discussion…"

/**
 * One discussion, with the answer put where the reader is looking.
 *
 * One read and no stage. Their page is Rails end to end, so the body, every comment and every
 * reply are in the markup before any script runs, and there is nothing here to defer.
 */
export const DiscussionScreen = ({
  reference,
  load,
  preload,
  onStepAside,
  recallRepositories,
  where,
  at,
  signedIn = viewerOnPage
}: DiscussionScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what={`Discussion #${reference.number} of ${reference.owner}/${reference.repo}`}
          onStepAside={onStepAside}
          asideLabel="Show GitHub's page"
        />
      </>
    )
  }

  const shown = read.status === "ready" ? read.value : undefined

  return (
    // The same wrapper for the wait and for the cards, holding both in the same slots throughout:
    // the wait has to be the same element on both sides of the answer, or the dissolve has
    // nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      <TheBar
        where={{ kind: "repository", owner: reference.owner, repo: reference.repo }}
        recall={recallRepositories}
      />
      {shown === undefined ? null : (
        <div className="t-panels flex flex-col pt-2 pb-2">
          <Discussion snapshot={shown} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${reference.owner}/${reference.repo} #${reference.number}`}
          room="list"
          leaving={shown !== undefined}
        />
      ) : null}
    </div>
  )
}
