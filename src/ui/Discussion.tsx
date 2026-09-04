import { Effect, Option } from "effect"
import { useState, type ReactNode } from "react"
import {
  type Answering,
  type Comment,
  type DiscussionPress,
  type DiscussionSnapshot,
  type Poll,
  type Reply,
  addressOf,
  answerOf,
  answeringOf,
  listAddressOf,
  spokenOn,
  weighingOf
} from "../domain/discussions"
import { Folded } from "./Folded"
import { GitHubHtml } from "./GitHubHtml"
import { Saying } from "./Saying"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"

/**
 * What the discussion is waiting for, in a word.
 *
 * The same four words the list uses, from the same rule, so a discussion filed under Needs You
 * on the list opens on the word Stale. Two screens that weighed the same thread differently
 * would leave the reader deciding which of them to believe.
 */
const SAID: Record<Answering, string> = {
  stale: "Stale",
  unanswered: "Unanswered",
  answered: "Answered",
  unanswerable: ""
}

const TONE: Record<Answering, string> = {
  stale: "text-busy",
  unanswered: "text-ink-muted",
  answered: "text-done",
  unanswerable: ""
}

/** How a press is sent, or nothing where this screen is drawn without one. */
type Pressing = ((press: DiscussionPress) => Effect.Effect<unknown, unknown>) | undefined

/**
 * A press GitHub itself offered, drawn only where it did.
 *
 * Never a control that fails when it is used. Every one of these is on the screen because
 * GitHub's own form for it is on the page, so a reader who is not signed in, a locked discussion
 * and an archived repository all draw the same thing, which is nothing.
 */
const Press = ({
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
                  setRefused(cause instanceof Error ? cause.message : String(cause))
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
 * One thing somebody said: who, when, and what.
 *
 * The body is GitHub's own rendered markdown, drawn by {@link GitHubHtml} rather than parsed by
 * `Markdown`. That component exists for exactly the payloads that arrive rendered, and a
 * discussion is the third of them: their page carries no markdown source anywhere, only the
 * article they made of it.
 */
const Said = ({
  said,
  where,
  marked = false,
  onPress
}: {
  readonly said: Reply
  /** The discussion's own address, so a permalink to this comment can be written. */
  readonly where: string
  /** Whether to say out loud that this is the marked Answer. */
  readonly marked?: boolean
  readonly onPress?: Pressing
}) => {
  const age = ageOf(said.at)

  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline gap-2 text-xs text-ink-muted">
        <span className="font-semibold text-ink">{said.author}</span>
        {age === "" ? null : (
          <a
            className="text-ink-muted no-underline hover:underline"
            href={`${where}#discussioncomment-${said.id}`}
            title={momentOf(said.at)}
          >
            {age}
          </a>
        )}
        {said.upvotes === 0 ? null : (
          <span className="tabular-nums">{`${said.upvotes} up`}</span>
        )}
        {marked ? <span className="font-semibold text-done">The answer</span> : null}
        {said.mayUpvote ? (
          <Press
            said={`Upvote what ${said.author} said`}
            onPress={onPress}
            press={{ kind: "upvote", on: "DiscussionComment", id: said.id }}
          >
            Upvote
          </Press>
        ) : null}
        {/* The press this whole screen exists for. On the eight repositories counted, 94 of the
            98 unanswered questions had somebody's reply in them and nobody had done this. */}
        {said.mayMarkAnswer ? (
          <Press
            said={marked ? "Take the answer mark off" : "Mark this as the answer"}
            onPress={onPress}
            press={{ kind: "mark-answer", comment: said.id }}
          >
            {marked ? "Unmark" : "Mark as answer"}
          </Press>
        ) : null}
      </div>
      <div className="mt-1 text-sm">
        <GitHubHtml html={said.body} />
      </div>
    </div>
  )
}

/**
 * A Poll, as the two things a reader wants from one: what it asked, and where the votes went.
 *
 * The results are always drawn, never hidden behind their "Show Results" press. A poll with two
 * votes on it is a poll whose answer is the point, and a reader who has not voted is not owed
 * less of it than one who has.
 *
 * Their percentage and their count, both taken as printed. They round, they round their way, and
 * a second arithmetic here would disagree with the page the reader just came from.
 */
const Voting = ({ poll, onPress }: { readonly poll: Poll; readonly onPress?: Pressing }) => (
  <Section
    name={poll.question}
    art="comments"
    summary={
      <span className="tabular-nums text-xs text-ink-muted">
        {poll.votes === 1 ? "1 vote" : `${poll.votes} votes`}
      </span>
    }
  >
    <ul className="list-none px-3 py-2">
      {poll.options.map((option) => (
        <li key={option.id} className="py-1">
          <div className="flex items-baseline gap-2 text-sm">
            <span className={option.chosen ? "font-semibold text-ink" : "text-ink"}>
              {option.name}
            </span>
            {option.chosen ? (
              <span className="text-xs text-done">Yours</span>
            ) : null}
            <span className="ml-auto tabular-nums text-xs text-ink-muted">{`${option.share}%`}</span>
            {poll.mayVote ? (
              <Press
                said={`Vote for ${option.name}`}
                onPress={onPress}
                press={{ kind: "vote", option: option.id }}
              >
                Vote
              </Press>
            ) : null}
          </div>
          {/* Their own bar, at their own width. A bar is what makes two numbers a shape. */}
          <div className="mt-1 h-1 w-full rounded bg-hover">
            <div className="h-1 rounded bg-busy" style={{ width: `${option.share}%` }} />
          </div>
        </li>
      ))}
    </ul>
    {poll.locked ? (
      <p className="px-3 pb-2 text-xs text-ink-muted">This poll is closed.</p>
    ) : null}
  </Section>
)

/**
 * One comment and the replies under it.
 *
 * Replies are drawn under their comment and never flattened into the list. GitHub allows one
 * level of nesting and no more, so the shape is small enough to keep, and losing it would turn a
 * three-reply side thread into three more comments in a column of nine.
 */
const Spoken = ({
  comment,
  where,
  onPress
}: {
  readonly comment: Comment
  readonly where: string
  readonly onPress?: Pressing
}) => (
  <li className="border-t border-edge first:border-t-0">
    <Said said={comment} where={where} marked={comment.isAnswer} onPress={onPress} />
    {comment.replies.length === 0 ? null : (
      <ul className="ml-6 list-none border-l border-edge">
        {comment.replies.map((reply) => (
          <li key={reply.id}>
            <Said said={reply} where={where} marked={reply.isAnswer} onPress={onPress} />
          </li>
        ))}
      </ul>
    )}
    {comment.mayReply && onPress !== undefined ? (
      <div className="ml-6 border-l border-edge px-3 py-2">
        <Saying
          subject="reply"
          keep={`discussion-reply:${where}#${comment.id}`}
          onSay={(body) => onPress({ kind: "reply", comment: comment.id, body })}
        />
      </div>
    ) : null}
  </li>
)

/**
 * The reply the most people upvoted, for a Question nobody has marked.
 *
 * Not a guess at the answer, and it does not claim to be one. It is the only ranking the page
 * itself supplies, and on a Stale Question it is the reply a reader is most likely to have come
 * for. Nothing where nobody has upvoted anything, because a list of zeroes ranks nothing.
 */
const mostUpvoted = (snapshot: DiscussionSnapshot): Option.Option<Reply> => {
  const every: ReadonlyArray<Reply> = snapshot.comments.flatMap((one) => [one, ...one.replies])
  const best = every.reduce<Reply | null>(
    (held, one) => (held === null || one.upvotes > held.upvotes ? one : held),
    null
  )

  return best === null || best.upvotes === 0 ? Option.none() : Option.some(best)
}

/**
 * One discussion: what was asked, what it is waiting for, and what was said.
 *
 * Not grouped into the four Courts, unlike the list this is opened from and unlike one pull
 * request. Those two sort many things by who owes the next move; a discussion is one thing, one
 * move is owed on it, and the header says which. Filing a single thread into four headings would
 * be the vocabulary used as decoration.
 *
 * What the screen does instead is put the answer where the reader is looking. A marked Answer is
 * drawn under the body and above the rest, because it is what somebody came for and GitHub puts
 * it in the thread wherever it happened to be said.
 */
export const Discussion = ({
  snapshot,
  onPress
}: {
  readonly snapshot: DiscussionSnapshot
  /**
   * How a press reaches GitHub, or nothing on a screen that only reads.
   *
   * Absent and every control disappears with it, which is the same as GitHub offering none. The
   * two gates are deliberate: the snapshot says what their page offered, and this says whether
   * anything is wired up to send it.
   */
  readonly onPress?: Pressing
}) => {
  const answering = answeringOf(weighingOf(snapshot))
  const said = SAID[answering]
  const answer = answerOf(snapshot)
  const likely = mostUpvoted(snapshot)
  const where = addressOf(snapshot.reference)
  const count = spokenOn(snapshot)

  return (
    <div className="flex flex-col gap-3">
      <Section
        name={snapshot.title}
        tone={answering === "stale" ? "attention" : "plain"}
        art="comments"
        summary={
          said === "" ? null : (
            <span className={`text-xs font-semibold ${TONE[answering]}`}>{said}</span>
          )
        }
      >
        <div className="flex flex-wrap items-baseline gap-2 px-3 pt-2 text-xs text-ink-muted">
          <span className="tabular-nums">{`#${snapshot.reference.number}`}</span>
          <a
            className="text-ink-muted no-underline hover:underline"
            href={listAddressOf(snapshot.reference, Option.some(snapshot.category.slug))}
          >
            {snapshot.category.name}
          </a>
          <span aria-hidden="true">·</span>
          <span>{snapshot.author}</span>
          {snapshot.askedAt === "" ? null : (
            <span title={momentOf(snapshot.askedAt)}>{ageOf(snapshot.askedAt)}</span>
          )}
          {snapshot.upvotes === 0 ? null : (
            <span className="tabular-nums">{`${snapshot.upvotes} up`}</span>
          )}
          {snapshot.allowed.upvote ? (
            <Press
              said="Upvote this discussion"
              onPress={onPress}
              press={{ kind: "upvote", on: "Discussion", id: snapshot.id }}
            >
              Upvote
            </Press>
          ) : null}
          {snapshot.closed ? <span className="font-semibold">Closed</span> : null}
          {snapshot.locked ? <span className="font-semibold">Locked</span> : null}
        </div>
        {/* Folded, because a body of three hundred lines puts the answer a screen below it,
            and on this page the answer is what somebody came for. `vercel/next.js` #70178 is
            700 pixels of question before the first reply. */}
        <div className="text-sm">
          <Folded>
            <GitHubHtml html={snapshot.body} />
          </Folded>
        </div>
      </Section>

      {Option.isSome(snapshot.poll) ? (
        <Voting poll={snapshot.poll.value} onPress={onPress} />
      ) : null}

      {Option.isSome(answer) ? (
        <Section name="The answer" tone="done" art="tick">
          <Said said={answer.value} where={where} onPress={onPress} />
        </Section>
      ) : null}

      {/* Only where nobody marked one and somebody upvoted something. On a Question this is the
          state 94 of 120 real rows are in, and the reply below is the nearest thing the page
          itself has to an answer. It is offered as what it is and never as the answer. */}
      {Option.isNone(answer) && Option.isSome(likely) && answering === "stale" ? (
        <Section
          name="Nobody marked an answer"
          tone="attention"
          art="needs-you"
          summary={<span className="text-xs text-ink-muted">most upvoted reply</span>}
        >
          <Said said={likely.value} where={where} onPress={onPress} />
        </Section>
      ) : null}

      <Section
        name={count === 1 ? "1 reply" : `${count} replies`}
        art="comments"
        summary={<span className="tabular-nums">{count}</span>}
      >
        {snapshot.comments.length === 0 ? (
          <p className="px-3 py-2 text-sm text-ink-muted">Nobody has replied.</p>
        ) : (
          /* Markers off explicitly. The bodies below are drawn inside `markdown-body`, whose
             stylesheet gives every list its bullet back, and it reaches these two as well. */
          <ul className="list-none">
            {snapshot.comments.map((comment) => (
              <Spoken key={comment.id} comment={comment} where={where} onPress={onPress} />
            ))}
          </ul>
        )}
      </Section>

      {/* The box GitHub renders at the foot of their own page, where they rendered one. A reader
          who is not signed in gets none, and neither does a locked discussion. */}
      {snapshot.allowed.say && onPress !== undefined ? (
        <Section name="Say something" art="comments">
          <div className="px-3 py-2">
            <Saying
              subject="discussion"
              keep={`discussion:${where}`}
              onSay={(body) => onPress({ kind: "say", body })}
            />
          </div>
        </Section>
      ) : null}
    </div>
  )
}
