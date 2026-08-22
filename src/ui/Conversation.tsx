import type { Effect } from "effect"
import { Option } from "effect"
import { useState } from "react"
import type { Participant, Remark, ReviewThread } from "../domain/PullRequest"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { speakersIn, unansweredFirst } from "../domain/threads"
import { useArt } from "./art"
import { Saying } from "./Saying"
import { Section } from "./Section"
import { summarise } from "./summarise"
import { type Answering, Comments, ThreadComments, useSettling } from "./ThreadView"
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

const Thread = ({
  thread,
  answering
}: {
  readonly thread: ReviewThread
  readonly answering?: Answering
}) => {
  const art = useArt()
  const Tick = art.tick
  const ChevronRight = art["chevron-right"]
  const [first] = thread.comments
  const [opened, setOpened] = useState(false)
  /*
   * The same state the foot of the thread presses against, so the mark on this line moves with
   * the button under it. Held one level up from `ThreadComments` because this line is where the
   * tick is, and the tick is the whole of what a resolved thread says at a glance.
   */
  const { resolved, answering: watched } = useSettling(thread, answering)

  return (
    <details
      className="group border-b border-line-muted last:border-b-0"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
        {/* The mark carries the state, not the dimming beside it: a settled
            thread that is only paler is a thread that says nothing at all to
            anyone reading this through a screen reader or in high contrast. */}
        {resolved ? (
          <Tick size={12} aria-label="Resolved" className="shrink-0 text-pass" />
        ) : (
          <ChevronRight
            size={12}
            className="shrink-0 text-ink-muted transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
          />
        )}
        {/* Receded rather than removed. A settled thread is still the record of
            why the code looks like this, and hiding it means the answer to
            "didn't we discuss this" is a trip back to GitHub. */}
        <span
          className={`flex min-w-0 flex-1 items-center gap-2 ${
            resolved ? "opacity-60" : ""
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
      {opened ? (
        <div className="border-t border-line-muted">
          <ThreadComments thread={{ ...thread, isResolved: resolved }} answering={watched} />
        </div>
      ) : null}
    </details>
  )
}

/**
 * A remark about the pull request itself, folded like a thread.
 *
 * No count and no mark: there is one comment, and nothing here to resolve. The
 * fold is kept because a deploy notice or a screenshot report runs to a screenful
 * of tables, and unfolded it would bury the threads that need an answer.
 */
const RemarkRow = ({ remark }: { readonly remark: Remark }) => {
  const art = useArt()
  const ChevronRight = art["chevron-right"]
  const [opened, setOpened] = useState(false)
  const comments = [
    { author: remark.author, body: remark.body, html: remark.html, createdAt: remark.createdAt }
  ]

  return (
    <details
      className="group border-b border-line-muted last:border-b-0"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={12}
          className="shrink-0 text-ink-muted transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Faces people={[remark.author]} />
          <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
            {summarise(remark.body)}
          </span>
        </span>
      </summary>
      {opened ? (
        <div className="border-t border-line-muted">
          <Comments id={remark.id} comments={comments} />
        </div>
      ) : null}
    </details>
  )
}

/**
 * How much of the conversation is still waiting on somebody.
 *
 * The open count leads because it is the number that decides whether this
 * pull request is finished. Saying "8 threads" counts a week of settled
 * nitpicks and the one live objection as the same thing. Remarks are counted
 * apart from both: one cannot be resolved and nobody owes it an answer, so
 * adding it to the open count would say work is outstanding when none is.
 */
const saidSoFar = (
  threads: ReadonlyArray<ReviewThread>,
  remarks: ReadonlyArray<Remark>
): string => {
  const said = remarks.length === 1 ? "1 remark" : `${remarks.length} remarks`

  if (threads.length === 0) return remarks.length === 0 ? "nothing said yet" : said

  const resolved = threads.filter((thread) => thread.isResolved).length
  const open = threads.length - resolved

  const threadsSay =
    resolved === 0 ? `${open} open` : open === 0 ? `all ${resolved} resolved` : `${open} open, ${resolved} resolved`

  return remarks.length === 0 ? threadsSay : `${threadsSay}, ${said}`
}

/**
 * Everything anyone said, folded.
 *
 * One line per thread — who spoke and what about — because a pull request with
 * twenty threads is a wall of text otherwise, and the wall was the complaint
 * that started this whole thing.
 *
 * Threads first, remarks after: a thread is owed an answer and a remark is not,
 * and this column is read top down for what is owed.
 */
export const Conversation = ({
  threads,
  remarks,
  viewer,
  subject,
  keep,
  suggest,
  onUpload,
  onReply,
  onSettle,
  onUnsettle,
  onSay
}: {
  readonly threads: ReadonlyArray<ReviewThread>
  readonly remarks: ReadonlyArray<Remark>
  /** Whoever is writing, so the box at the foot is signed as the remark will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /**
   * What this conversation is about, for the box at the foot to name.
   *
   * This panel draws an issue as readily as a pull request — an issue has no
   * lines, so every comment on one is a Remark and the thread half is simply
   * empty — and the one place that difference shows is the words on the box.
   */
  readonly subject?: string
  /** Says something about the pull request. Absent where nothing is wired up to. */
  readonly onSay?: (body: string) => Effect.Effect<unknown, unknown>
  /** What an unsent draft is kept under, where this conversation is worth keeping one for. */
  readonly keep?: string
  /** Who can be mentioned and what can be referred to. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  /** Answers inside a thread, and says what it holds afterwards. See `ThreadView`. */
  readonly onReply?: Answering["onReply"]
  readonly onSettle?: Answering["onSettle"]
  readonly onUnsettle?: Answering["onUnsettle"]
}) => (
  <Section name="Conversation" summary={saidSoFar(threads, remarks)}>
    {unansweredFirst(threads).map((thread) => (
      <Thread
        key={thread.id}
        thread={thread}
        answering={{ viewer, suggest, onUpload, onReply, onSettle, onUnsettle }}
      />
    ))}
    {remarks.map((remark) => (
      <RemarkRow key={remark.id} remark={remark} />
    ))}
    {/* Last, under everything said so far, because that is the order it is read
        in: a reader reaches the box having reached the end of the discussion. */}
    {onSay === undefined ? null : (
      <Saying
        viewer={viewer}
        subject={subject}
        keep={keep}
        suggest={suggest}
        onUpload={onUpload}
        onSay={onSay}
      />
    )}
  </Section>
)
