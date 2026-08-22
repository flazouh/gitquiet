import { type Effect, Option } from "effect"
import { useMemo, useState } from "react"
import type { Notice, Press } from "../domain/notices"
import type { Repository } from "../domain/repositories"
import { Notices } from "./Notices"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { TheBar } from "./TheBar"
import { useUpdated } from "./useUpdated"
import { type Load, useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type NoticesScreenProps = {
  readonly load: Load<ReadonlyArray<Notice>>
  /**
   * The inbox as the last visit left it, painted while the live read is in the air.
   *
   * Worth more here than on any other list. An inbox is the first page a reader opens and the
   * one they come back to between everything else, and GitHub's own takes most of a second to
   * serve.
   */
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<Notice>>>
  /** Carries out one of GitHub's own forms, read off the row it belongs to. */
  readonly onPress: (press: Press) => void
  /** Restores GitHub's own inbox, which is still on the page behind this. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
}

const READING = "Reading your notifications…"

const UPDATED = "Notices updated"

/**
 * What a press did to a Notice, held here until the next read confirms it.
 *
 * Their server answers every one of these with a zero-byte body, so there is nothing to draw
 * from the answer and no way to tell a refusal from a success by it. The row is redrawn from
 * what was asked for instead, which is the same bargain the run screen's two presses take, and
 * the next live read is what settles it either way.
 */
type Since = {
  readonly unread?: boolean
  readonly subscribed?: boolean
  /** Archived, which takes it out of the inbox. There is nothing left to draw. */
  readonly gone?: boolean
}

const AFTER: Readonly<Record<string, Since>> = {
  mark: { unread: false },
  unmark: { unread: true },
  archive: { gone: true },
  unarchive: { gone: true },
  subscribe: { subscribed: true },
  unsubscribe: { subscribed: false }
}

/**
 * Every Notice the reader is subscribed to — `/notifications`.
 *
 * Four Courts and no filter box, which is the decision this codebase has already made twice:
 * their pane goes with their list, because a screen that groups and a pane that filters would
 * put two sets of controls on one page that disagree about what is on the screen. It is also
 * the one page where their pane demonstrably cannot answer the question — `is:open` returns
 * zero rows rather than an error — so the reader who tried the obvious thing was told they had
 * no open notifications.
 *
 * The presses stay on the rows. A reader looking at a Court holding the work that is already
 * finished is one press away from emptying it, and that is the whole of what the grouping buys
 * them: on the inbox this was measured against, 41 rows of 51 were about something merged or
 * closed.
 */
export const NoticesScreen = ({
  load,
  preload,
  onPress,
  onStepAside,
  recallRepositories,
  signedIn = viewerOnPage
}: NoticesScreenProps) => {
  const live = useLive(load, preload)
  const { read } = live
  const waiting = useWaiting(read.status)
  useUpdated(live.catchingUp, read.status === "ready" ? read.value : undefined, UPDATED)

  /*
   * Keyed by GitHub's own thread id rather than by the row's place in the list, because the
   * live read behind this can re-order the inbox or drop a row from it. A correction that
   * followed an index would land on whatever moved into it.
   */
  const [since, setSince] = useState<Readonly<Record<string, Since>>>({})

  const notices = read.status === "ready" ? read.value : undefined

  const shown = useMemo(
    () =>
      notices?.flatMap((one): ReadonlyArray<Notice> => {
        const done = since[one.id]
        if (done === undefined) return [one]
        if (done.gone === true) return []

        return [
          {
            ...one,
            unread: done.unread ?? one.unread,
            subscribed: done.subscribed ?? one.subscribed
          }
        ]
      }),
    [notices, since]
  )

  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        why={read.why}
        what="Your notifications"
        onStepAside={onStepAside}
        asideLabel="Show GitHub's inbox"
      />
    )
  }

  const pressed = (press: Press): void => {
    const after = AFTER[press.kind]
    if (after !== undefined) {
      setSince((held) =>
        Object.fromEntries([
          ...Object.entries(held),
          // Every id on the form, because `mark` and `unmark` are bulk routes: their forms take
          // a list, and a screen that grew a way to press one over a Court would send several.
          ...press.ids.map((id) => [id, { ...held[id], ...after }] as const)
        ])
      )
    }

    onPress(press)
  }

  return (
    // The same wrapper for the wait and for the list, holding both in the same two slots
    // throughout: the wait has to be the same element on both sides of the answer, or the
    // dissolve has nothing to start from.
    <div className="relative">
      <TheBar where={{ kind: "home" }} recall={recallRepositories} unread={unreadIn(shown)} />
      {shown === undefined ? null : (
        <div className="t-panels flex flex-col gap-1 py-3">
          <Notices notices={shown} onPress={pressed} />
        </div>
      )}
      {waiting ? (
        <Waiting what={READING} room="list" leaving={shown !== undefined} />
      ) : null}
    </div>
  )
}

/**
 * Whether the bar's own tray wears its dot, which on this page it reads off the rows.
 *
 * Everywhere else the bar asks GitHub. Here the inbox is on the screen, so a reader who marks
 * the last unread row read watches the dot go out in the same frame rather than on their next
 * navigation.
 */
const unreadIn = (notices: ReadonlyArray<Notice> | undefined): boolean | undefined =>
  notices === undefined ? undefined : notices.some((one) => one.unread)
