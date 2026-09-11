import { Effect, type Option } from "effect"
import { useState } from "react"
import { type DiscussionPress, type DiscussionSnapshot, type Doing } from "../domain/discussions"
import { homeName, type DiscussionRef } from "../domain/discussionRoutes"
import type { Repository } from "../domain/repositories"
import { Discussion } from "./Discussion"
import { whereFor } from "./Discussions"
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
  /**
   * How a press reaches GitHub, or nothing on a screen that only reads.
   *
   * Every control is behind two gates: this, and whether GitHub's own form for it was on the
   * page. A test that only draws the screen passes neither and gets a discussion to read.
   */
  readonly onPress?: (press: DiscussionPress) => Effect.Effect<DiscussionSnapshot, unknown>
  /**
   * How their own menu is read, or nothing on a screen that only reads.
   *
   * Asked when a reader opens the menu rather than when the discussion is read: a thread of
   * thirty comments would otherwise be thirty-one requests to draw one page.
   */
  readonly onAsk?: (
    on: "Discussion" | "DiscussionComment",
    id: string
  ) => Effect.Effect<ReadonlyArray<Doing>, unknown>
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
  onPress,
  onAsk,
  onStepAside,
  recallRepositories,
  where,
  at,
  signedIn = viewerOnPage
}: DiscussionScreenProps) => {
  const named = homeName(reference.home)
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)

  /*
   * What the last press answered with, which is the discussion read again. Held here rather than
   * pushed back through `useLive`, because a press is not a fresh visit: the reader is standing
   * where they were and one thing about it changed.
   */
  const [written, setWritten] = useState<DiscussionSnapshot | undefined>(undefined)

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what={`Discussion #${reference.number} of ${named}`}
          onStepAside={onStepAside}
          asideLabel="Show GitHub's page"
        />
      </>
    )
  }

  const answered = read.status === "ready" ? read.value : undefined
  const shown = written ?? answered

  const pressing =
    onPress === undefined
      ? undefined
      : (press: DiscussionPress) =>
          onPress(press).pipe(Effect.tap((fresh) => Effect.sync(() => setWritten(fresh))))

  return (
    // The same wrapper for the wait and for the cards, holding both in the same slots throughout:
    // the wait has to be the same element on both sides of the answer, or the dissolve has
    // nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      <TheBar where={whereFor(reference.home)} recall={recallRepositories} />
      {shown === undefined ? null : (
        <div className="t-panels flex flex-col pt-2 pb-2">
          <Discussion snapshot={shown} onPress={pressing} onAsk={onAsk} />
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${named} #${reference.number}`}
          room="list"
          leaving={shown !== undefined}
        />
      ) : null}
    </div>
  )
}
