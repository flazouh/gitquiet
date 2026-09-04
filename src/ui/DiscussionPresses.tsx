/**
 * Every control on a discussion that sends something back, and the state each one holds.
 *
 * Its own file because these are the only parts of the screen that are not drawing. A press runs
 * an Effect, waits, and says out loud what GitHub refused; their menu is fetched the moment a
 * reader opens it and not before. The thread beside them is a pure read of one snapshot, and
 * keeping the two apart makes that true of the files as well as of the components.
 */
import { Effect } from "effect"
import { useState, type ReactNode } from "react"
import type { DiscussionPress, Doing } from "../domain/discussions"
import { reasonFor } from "./refusal"

/** How a press is sent, or nothing where this screen is drawn without one. */
export type Pressing = ((press: DiscussionPress) => Effect.Effect<unknown, unknown>) | undefined

/** How their menu is asked for, or nothing where this screen is drawn without one. */
export type Asking =
  | ((on: "Discussion" | "DiscussionComment", id: string) => Effect.Effect<
      ReadonlyArray<Doing>,
      unknown
    >)
  | undefined

/**
 * A press GitHub itself offered, drawn only where it did.
 *
 * Never a control that fails when it is used. Every one of these is on the screen because
 * GitHub's own form for it is on the page, so a reader who is not signed in, a locked discussion
 * and an archived repository all draw the same thing, which is nothing.
 */
export const Press = ({
  said,
  onPress,
  press,
  children
}: {
  readonly said: string
  readonly onPress: Pressing
  readonly press: DiscussionPress
  readonly children: ReactNode
}) => {
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)

  if (onPress === undefined) return null

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        aria-label={said}
        disabled={sending}
        className="rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-50"
        onClick={() => {
          setSending(true)
          setRefused(undefined)

          Effect.runFork(
            onPress(press).pipe(
              Effect.match({
                onSuccess: () => setSending(false),
                /*
                 * Said out loud rather than swallowed. Every one of these presses is offered
                 * because GitHub's own form for it was on the page, so a refusal means something
                 * changed underneath the reader and they are owed the reason.
                 */
                onFailure: (cause: unknown) => {
                  setRefused(reasonFor(cause))
                  setSending(false)
                }
              })
            )
          )
        }}
      >
        {children}
      </button>
      {refused === undefined ? null : (
        <span role="alert" className="text-xs text-fail">
          {refused}
        </span>
      )}
    </span>
  )
}

/**
 * Everything else GitHub offers on one thing, in their own words.
 *
 * Closed until it is opened, and asked for then, because that is when their own page asks and
 * because a discussion with thirty comments would otherwise be thirty-one requests to draw.
 *
 * This codebase knows none of these actions by name. What comes back is a list of GitHub's own
 * sentences, and pressing one sends the form that sentence sits on — so the day they add one, it
 * is here, and the day they rename one, it is renamed here.
 *
 * A destructive entry asks twice. GitHub marks those in their own markup where they mark them at
 * all, and nothing here decides which of their entries deletes something.
 */
export const More = ({
  on,
  id,
  onAsk,
  onPress
}: {
  readonly on: "Discussion" | "DiscussionComment"
  readonly id: string
  readonly onAsk: Asking
  readonly onPress: Pressing
}) => {
  const [doings, setDoings] = useState<ReadonlyArray<Doing> | undefined>(undefined)
  const [sure, setSure] = useState<string | undefined>(undefined)

  if (onAsk === undefined || onPress === undefined) return null

  return (
    <details
      className="inline-block"
      onToggle={(event) => {
        if (!(event.currentTarget as HTMLDetailsElement).open || doings !== undefined) return
        Effect.runFork(
          onAsk(on, id).pipe(
            Effect.match({
              onSuccess: (found) => setDoings(found),
              // An empty menu, which is what a reader who may do nothing is shown.
              onFailure: () => setDoings([])
            })
          )
        )
      }}
    >
      <summary className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-ink-muted hover:bg-hover hover:text-ink">
        More
      </summary>
      {doings === undefined ? (
        <p className="px-2 py-1 text-xs text-ink-muted">Asking GitHub…</p>
      ) : doings.length === 0 ? (
        <p className="px-2 py-1 text-xs text-ink-muted">GitHub offers nothing here.</p>
      ) : (
        <ul className="list-none py-1">
          {doings.map((doing) => (
            <li key={doing.said}>
              {doing.danger && sure !== doing.said ? (
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-xs text-fail hover:bg-hover"
                  onClick={() => setSure(doing.said)}
                >
                  {doing.said}
                </button>
              ) : (
                <Press
                  said={doing.danger ? `${doing.said}, and mean it` : doing.said}
                  onPress={onPress}
                  press={{ kind: "doing", on, id, said: doing.said }}
                >
                  <span className={doing.danger ? "text-fail" : undefined}>
                    {doing.danger ? `${doing.said} — press again` : doing.said}
                  </span>
                </Press>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
