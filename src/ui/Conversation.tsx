import { CheckIcon, ChevronRightIcon } from "@primer/octicons-react"
import { Option } from "effect"
import type { Participant, ReviewThread } from "../domain/PullRequest"
import { speakersIn, unansweredFirst } from "../domain/threads"
import { Section } from "./Section"
import { summarise } from "./summarise"
import { ThreadComments } from "./ThreadView"
import { Who } from "./Who"

/** How many faces a folded line carries before the rest become a number. */
const SHOWN = 3

/**
 * Who is in this thread, as faces rather than as a login.
 *
 * A login is read letter by letter and takes as much of a four-hundred pixel
 * column as the remark itself does — and the remark is the part worth reading.
 * A face is recognised without being read, several of them fit where one name
 * did, and the name is still one hover away.
 */
const Faces = ({ people }: { readonly people: ReadonlyArray<Participant> }) => (
  <span className="flex shrink-0 items-center">
    {people.slice(0, SHOWN).map((person) => (
      // Overlapped, with a ring in the panel's own colour so the one behind
      // reads as behind rather than as a smudge on the one in front.
      <span key={person.login} className="-ml-1.5 rounded-full ring-2 ring-canvas first:ml-0">
        <Who login={person.login} src={Option.getOrUndefined(person.faceUrl)} />
      </span>
    ))}
    {people.length > SHOWN ? (
      <span className="pl-1 text-xs text-ink-muted tabular-nums">{`+${people.length - SHOWN}`}</span>
    ) : null}
  </span>
)

const Thread = ({ thread }: { readonly thread: ReviewThread }) => {
  const [first] = thread.comments

  return (
    <details className="group border-b border-line-muted last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
        {/* The mark carries the state, not the dimming beside it: a settled
            thread that is only paler is a thread that says nothing at all to
            anyone reading this through a screen reader or in high contrast. */}
        {thread.isResolved ? (
          <CheckIcon size={12} aria-label="Resolved" className="shrink-0 text-pass" />
        ) : (
          <ChevronRightIcon
            size={12}
            className="shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-90"
          />
        )}
        {/* Receded rather than removed. A settled thread is still the record of
            why the code looks like this, and hiding it means the answer to
            "didn't we discuss this" is a trip back to GitHub. */}
        <span
          className={`flex min-w-0 flex-1 items-center gap-2 ${
            thread.isResolved ? "opacity-60" : ""
          }`}
        >
          <Faces people={speakersIn(thread)} />
          <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
            {summarise(first?.body ?? "")}
          </span>
          <span className="shrink-0 text-xs text-ink-muted tabular-nums">
            {thread.comments.length}
          </span>
        </span>
      </summary>
      <div className="border-t border-line-muted">
        <ThreadComments thread={thread} />
      </div>
    </details>
  )
}

/**
 * How much of the conversation is still waiting on somebody.
 *
 * The open count leads because it is the number that decides whether this
 * pull request is finished. Saying "8 threads" counts a week of settled
 * nitpicks and the one live objection as the same thing.
 */
const saidSoFar = (threads: ReadonlyArray<ReviewThread>): string => {
  if (threads.length === 0) return "nothing said yet"

  const resolved = threads.filter((thread) => thread.isResolved).length
  const open = threads.length - resolved

  if (resolved === 0) return `${open} open`
  if (open === 0) return `all ${resolved} resolved`
  return `${open} open, ${resolved} resolved`
}

/**
 * Everything anyone said, folded.
 *
 * One line per thread — who spoke and what about — because a pull request with
 * twenty threads is a wall of text otherwise, and the wall was the complaint
 * that started this whole thing.
 */
export const Conversation = ({ threads }: { readonly threads: ReadonlyArray<ReviewThread> }) => (
  <Section name="Conversation" summary={saidSoFar(threads)}>
    {threads.length === 0 ? (
      <></>
    ) : (
      unansweredFirst(threads).map((thread) => <Thread key={thread.id} thread={thread} />)
    )}
  </Section>
)
