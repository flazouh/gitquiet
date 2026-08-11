import { Effect, Option } from "effect"
import { useState } from "react"
import type { ReviewThread, ThreadComment } from "../domain/PullRequest"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { useArt } from "./art"
import { PRESSABLE } from "./dress"
import { forget, held, hold } from "./held"
import { Markdown } from "./Markdown"
import { Says } from "./says"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"
import { Writing } from "./Writing"

/**
 * What can be done to a thread from where it is read.
 *
 * One bundle rather than five props, because these five travel together through four
 * components that do nothing with any of them: the diff hands them to a thread hanging off a
 * line, the conversation hands the same five to the same thread folded in a column.
 *
 * Every field is optional, and absent means the thread is read-only, which is what every
 * thread on this interface was until now.
 */
export type Answering = {
  /** Whoever is writing, so the box is signed the way the reply will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string }
  /**
   * Answers inside the thread, and says what it holds afterwards.
   *
   * Addressed to a comment rather than to the thread: their route wants the number of the
   * comment being replied to. See `replying.md`.
   */
  readonly onReply?: (
    commentId: string,
    body: string
  ) => Effect.Effect<ReadonlyArray<ThreadComment>, unknown>
  readonly onSettle?: (threadId: string) => Effect.Effect<unknown, unknown>
  readonly onUnsettle?: (threadId: string) => Effect.Effect<unknown, unknown>
  /** Who can be mentioned and what can be referred to. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /** A file pasted or dropped into the reply box. See `attaching.ts`. */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}

/**
 * What was said, whoever is asking and wherever it was said.
 *
 * The same rows in the column, in the diff and for a remark about the pull
 * request itself, because they are the same remarks: a reader who has learnt to
 * read one of them has learnt to read the rest, and several renderings of one
 * thing drift apart the week after they are written.
 */
export const Comments = ({
  id,
  comments,
  flush = false
}: {
  /** Only for keying the rows, so two remarks by one person stay distinct. */
  readonly id: string
  readonly comments: ReadonlyArray<ThreadComment>
  /** Set where the surrounding row already supplies the padding and the edge. */
  readonly flush?: boolean
}) => (
  <div className="divide-y divide-line-muted">
    {comments.map((comment, index) => (
      <article
        key={`${id}:${index}`}
        className={`flex flex-col gap-1.5 ${flush ? "py-2 first:pt-0 last:pb-0" : "px-3 py-2.5"}`}
      >
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <Who login={comment.author.login} src={Option.getOrUndefined(comment.author.faceUrl)} />
          {comment.author.isAutomated ? <span className="Label">bot</span> : null}
          <span title={momentOf(comment.createdAt)}>{ageOf(comment.createdAt)}</span>
        </span>
        <Markdown html={comment.html} />
      </article>
    ))}
  </div>
)

/**
 * Whether a thread is settled, as the reader last left it rather than as the last read said.
 *
 * The press moves the mark, and only a refusal moves it back. A tick that waits for a round trip
 * reads as a button that did nothing, and the reader presses it again — which is what the column
 * did until this was here.
 *
 * Until something is pressed, whatever was read last wins: somebody else resolving a thread in
 * another window shows up here on the next read, as it should.
 */
export const useSettling = (thread: ReviewThread, answering?: Answering) => {
  const [ours, setOurs] = useState<boolean>()
  const resolved = ours ?? thread.isResolved

  const said = (asked: boolean, act?: (id: string) => Effect.Effect<unknown, unknown>) =>
    act === undefined
      ? undefined
      : (id: string) => {
          setOurs(asked)
          return act(id).pipe(Effect.tapError(() => Effect.sync(() => setOurs(!asked))))
        }

  const watched: Answering | undefined =
    answering === undefined
      ? undefined
      : {
          ...answering,
          onSettle: said(true, answering.onSettle),
          onUnsettle: said(false, answering.onUnsettle)
        }

  return { resolved, answering: watched }
}

/** What the send button says, at rest and while GitHub is being asked. */
const WORDS = ["Reply", "Posting…"] as const

/**
 * What the button that ends a thread says, both ways round.
 *
 * One word each rather than a pair, which is the one control here that does not swap into a
 * waiting word. The mark and the label flip at the press — see `useSettling` — so a "Resolving…"
 * in the same cell would be the button saying it is still asking while the tick beside it says
 * the thread is settled. `aria-busy` carries that to a reader being read to.
 */
const ENDS = "Resolve"
const OPENS = "Open again"

/**
 * The foot of a thread: answer it, and end it.
 *
 * Both here rather than one here and one on GitHub's page, because they are the two halves of
 * the same act. Counted over twenty pull requests of `octo-org/octo-repo`, a person
 * resolved 50 of the 67 findings somebody had answered: answering and resolving is what
 * finishing a thread means, and until now the second half sent the reader away.
 *
 * Folded until pressed. A box under every thread on a pull request with twenty of them is two
 * hundred pixels twenty times, for a page that is usually read without a word being added.
 */
const Answer = ({
  thread,
  comments,
  answering,
  onSaid
}: {
  readonly thread: ReviewThread
  readonly comments: ReadonlyArray<ThreadComment>
  readonly answering: Answering
  readonly onSaid: (comments: ReadonlyArray<ThreadComment>) => void
}) => {
  const art = useArt()
  /*
   * An unsent answer outlives the page it was written on, and opens the box on arrival.
   *
   * The one thing people say they lose on GitHub's own review pages: a paragraph typed into a
   * thread and never sent is gone with the tab. Kept under the thread's own id, so two threads
   * on one pull request keep two answers. See `held.ts`.
   */
  const keep = `thread:${thread.id}`
  const [waiting] = useState(() => held(keep))
  const [writing, setWriting] = useState(waiting !== "")
  const [text, setText] = useState(waiting)
  const [saying, setSaying] = useState(false)
  const [settling, setSettling] = useState(false)
  const [refused, setRefused] = useState<string>()

  /*
   * The comment a reply is addressed to, which is the first one in the thread.
   *
   * The first rather than the last: their route takes any comment in the thread and files the
   * reply at the end either way, and the first is the one that is certainly still there — the
   * last may have been deleted by whoever wrote it a moment ago.
   */
  const to = comments.find((one) => one.id !== undefined)?.id

  const answer =
    answering.onReply === undefined || to === undefined || thread.canReply === false
      ? undefined
      : answering.onReply

  const end = thread.isResolved ? answering.onUnsettle : answering.onSettle

  const say = () => {
    const written = text.trim()
    if (written === "" || saying || answer === undefined || to === undefined) return

    setSaying(true)
    setRefused(undefined)
    Effect.runFork(
      answer(to, written).pipe(
        Effect.match({
          onSuccess: (said) => {
            setSaying(false)
            setText("")
            forget(keep)
            setWriting(false)
            onSaid(said)
          },
          // Kept in the box, as everywhere else here: whatever GitHub objected to, the
          // paragraph that was typed is the one thing that cannot be fetched again.
          onFailure: (cause: unknown) => {
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setSaying(false)
          }
        })
      )
    )
  }

  const settle = () => {
    if (end === undefined || settling) return

    setSettling(true)
    Effect.runFork(
      end(thread.id).pipe(Effect.ensuring(Effect.sync(() => setSettling(false))))
    )
  }

  if (answer === undefined && end === undefined) return null

  /*
   * The glyph says what the press will do, not what a tick means elsewhere.
   *
   * A green tick beside the word "Resolve" was the row saying the thread was settled and
   * offering to settle it, in the same breath. Muted while there is something to end, and the
   * circle that reopens things — the one `Settle` puts on an issue's reopen — once it is ended.
   */
  const Mark = thread.isResolved ? art.issue : art.tick
  const word = thread.isResolved ? OPENS : ENDS

  return (
    // Divided from the remarks above it the way those are divided from each other: this is the
    // foot of the thread rather than another paragraph in it.
    <div className="mt-2 flex flex-col gap-1.5 border-t border-line-muted pt-2">
      {writing ? (
        <>
          <Writing
            text={text}
            onText={(said) => {
              setText(said)
              hold(keep, said)
            }}
            placeholder="Answer this"
            onEscape={() => setWriting(false)}
            onSend={say}
            suggest={answering.suggest}
            onUpload={answering.onUpload}
          />
          {refused === undefined ? null : (
            <p className="text-xs text-fail">GitHub would not take that: {refused}</p>
          )}
        </>
      ) : null}
      <div className="flex items-center gap-1.5">
        {answer === undefined ? null : writing ? (
          <>
            <button
              type="button"
              disabled={text.trim() === "" || saying}
              aria-busy={saying ? true : undefined}
              onClick={say}
              className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis enabled:hover:opacity-90 disabled:opacity-40"
            >
              <Says among={WORDS} said={saying ? WORDS[1] : WORDS[0]} waiting={WORDS[1]} />
            </button>
            <button
              type="button"
              disabled={saying}
              onClick={() => setWriting(false)}
              className={`${PRESSABLE} px-2.5 py-1 text-xs font-semibold text-ink enabled:hover:bg-active`}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className={`${PRESSABLE} flex-1 px-2.5 py-1 text-left text-xs text-ink-muted hover:bg-active hover:text-ink`}
          >
            {text.trim() === "" ? "Answer this" : "Carry on with your answer"}
          </button>
        )}
        {end === undefined ? null : (
          <button
            type="button"
            disabled={settling}
            aria-busy={settling ? true : undefined}
            onClick={settle}
            className={`${PRESSABLE} flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-ink-muted enabled:hover:bg-active enabled:hover:text-ink disabled:opacity-50`}
          >
            <Mark size={12} aria-hidden="true" className="shrink-0" />
            {word}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A thread, and what can be done about it.
 *
 * What a reply adds is held here rather than waited for from the next read: GitHub answers a
 * reply with the whole thread, so the answer that was just written is on the screen before
 * anything is read again. Resolving is the same, one state up: the tick moves at the press.
 */
export const ThreadComments = ({
  thread,
  flush = false,
  answering
}: {
  readonly thread: ReviewThread
  readonly flush?: boolean
  readonly answering?: Answering
}) => {
  const [said, setSaid] = useState<ReadonlyArray<ThreadComment>>()
  const comments = said ?? thread.comments

  return (
    <div className={flush ? "" : "px-3 pb-2"}>
      <Comments id={thread.id} comments={comments} flush={flush} />
      {answering === undefined ? null : (
        <Answer thread={thread} comments={comments} answering={answering} onSaid={setSaid} />
      )}
    </div>
  )
}

/**
 * A thread as it appears in the diff, against the line it is about.
 *
 * Nothing is folded here. In the column a folded line is what keeps twenty
 * threads from being a wall; hung off its own line there is only ever one of
 * these on screen at a time, and folding it would mean a click to read the
 * remark the reader has just scrolled to.
 */
export const ThreadInDiff = ({
  thread,
  answering
}: {
  readonly thread: ReviewThread
  readonly answering?: Answering
}) => {
  const art = useArt()
  const Tick = art.tick
  const { resolved, answering: watched } = useSettling(thread, answering)

  return (
    // Flat, because the row this is portalled into is already a bordered,
    // padded surface hanging under the line. A box inside that box draws two
    // edges around one remark.
    <section aria-label={`Review thread ${thread.id}`}>
      {resolved ? (
        <p className="flex items-center gap-2 pb-1.5 text-xs text-ink-muted">
          <Tick size={12} aria-label="Resolved" className="shrink-0 text-pass" />
          Resolved
        </p>
      ) : null}
      <div className={resolved ? "opacity-60" : ""}>
        <ThreadComments thread={{ ...thread, isResolved: resolved }} flush answering={watched} />
      </div>
    </section>
  )
}
