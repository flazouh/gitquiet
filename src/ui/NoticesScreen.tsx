import { Effect, Option } from "effect"
import { useEffect, useMemo, useState } from "react"
import type { Notice, Press } from "../domain/notices"
import type { Repository } from "../domain/repositories"
import { Notices } from "./Notices"
import { ReadFailed, viewerOnPage } from "./ReadFailed"
import { DrawnAt } from "./drawnAt"
import { TheBar } from "./TheBar"
import { type Load, useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import { wornOut } from "./worn"

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
  readonly onPress: (press: Press) => Effect.Effect<void, unknown>
  /** Restores GitHub's own inbox, which is still on the page behind this. */
  readonly onStepAside: () => void
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string
}

const READING = "Reading your notifications…"

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
  /**
   * When the press was made, which is what lets a correction be given up on.
   *
   * These used to be kept forever. Nothing compared a press against the read
   * behind it, so a Notice marked read a minute ago went on being drawn read
   * however many times the inbox arrived saying otherwise — and an inbox that
   * cannot be corrected by its own read is the one outcome this screen must not
   * have. Now a press comes off the moment the read says the same thing, and is
   * given up on after the window in `worn.ts` either way.
   */
  readonly at: number
}

/** What each press claims, before the moment it was made is put on it. */
const AFTER: Readonly<Record<string, Omit<Since, "at">>> = {
  mark: { unread: false },
  unmark: { unread: true },
  archive: { gone: true },
  // Nothing, and not `gone`. Un-archiving puts a Notice back into the inbox this
  // screen is reading, so the row belongs where it is. It said `gone` — the same
  // as archiving — which would have taken the row away for doing the opposite.
  unarchive: {},
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
  where,
  at,
  signedIn = viewerOnPage
}: NoticesScreenProps) => {
  const live = useLive(load, preload, where)
  const { read, again } = live
  const waiting = useWaiting(read.status)

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
        if (done === undefined || wornOut(done.at)) return [one]
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

  /*
   * A press comes off the moment the inbox says the same thing.
   *
   * Archiving is the one that needs no comparison: a row the inbox no longer
   * carries is a row GitHub has agreed about, and the entry has nothing left to
   * hide. The other two are read off the row itself.
   */
  useEffect(() => {
    if (notices === undefined) return

    setSince((held) => {
      const kept = Object.entries(held).filter(([id, done]) => {
        const still = notices.find((one) => one.id === id)
        if (done.gone === true) return still !== undefined
        if (still === undefined) return false

        return (
          (done.unread !== undefined && done.unread !== still.unread) ||
          (done.subscribed !== undefined && done.subscribed !== still.subscribed)
        )
      })

      return kept.length === Object.keys(held).length ? held : Object.fromEntries(kept)
    })
  }, [notices])

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what="Your notifications"
          onStepAside={onStepAside}
          asideLabel="Show GitHub's inbox"
        />
      </>
    )
  }

  const pressed = (press: Press): void => {
    // Empty for a press that changes nothing on the row, which is not the same as
    // a press that does nothing: the write still goes, and the refusal still has
    // to be heard. It is also the list of fields to take back, below.
    const after = AFTER[press.kind] ?? {}

    const at = Date.now()

    setSince((held) =>
      Object.fromEntries([
        ...Object.entries(held),
        // Every id on the form, because `mark` and `unmark` are bulk routes: their forms take
        // a list, and a screen that grew a way to press one over a Court would send several.
        ...press.ids.map((id) => [id, { ...held[id], ...after, at }] as const)
      ])
    )

    /*
     * A refusal takes the row back to what it was and reads the inbox again.
     *
     * This used to be sent and forgotten. The row stayed the way the reader had
     * asked for it whatever GitHub said, so an archive their server refused left
     * a Notice off the screen until the page was opened again — which is the one
     * outcome an inbox must never have.
     */
    Effect.runFork(
      onPress(press).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            // Only what this press set. Dropping the row's whole entry took an
            // earlier success with it: mark a Notice read, archive it, have the
            // archive refused, and it came back unread as well as back.
            setSince((held) =>
              Object.fromEntries(
                Object.entries(held).map(([id, was]) =>
                  press.ids.includes(id)
                    ? [
                        id,
                        Object.fromEntries(
                          Object.entries(was).filter(([field]) => !(field in after))
                        ) as Since
                      ]
                    : [id, was]
                )
              )
            )
            again()
          })
        )
      )
    )
  }

  return (
    // The same wrapper for the wait and for the list, holding both in the same two slots
    // throughout: the wait has to be the same element on both sides of the answer, or the
    // dissolve has nothing to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
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
