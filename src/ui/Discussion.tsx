import { Option } from "effect"
import {
  answerOf,
  answeringOf,
  spokenOn,
  weighingOf,
  type Comment,
  type DiscussionSnapshot,
  type Reaction,
  type Reply
} from "../domain/discussions"
import { addressOf, listAddressOf } from "../domain/discussionRoutes"
import { ANSWERING_SAID, ANSWERING_TONE } from "./courts"
import { More, Press, type Asking, type Pressing } from "./DiscussionPresses"
import { Folded } from "./Folded"
import { GitHubHtml } from "./GitHubHtml"
import { Voting } from "./Poll"
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


/**
 * The faces on one thing, each of them a press where GitHub offered one.
 *
 * Only the ones somebody has actually used. Their page keeps the other seven behind a menu, and
 * a row of eight zeroes under every comment is eight things to read and nothing to learn.
 *
 * Drawn apart from the upvote beside it, because GitHub counts them apart: an upvote ranks a
 * discussion and a face is an opinion about one thing somebody said.
 */
const Faces = ({
  reactions,
  on,
  id,
  onPress
}: {
  readonly reactions: ReadonlyArray<Reaction>
  readonly on: "Discussion" | "DiscussionComment"
  readonly id: string
  readonly onPress?: Pressing
}) => {
  if (reactions.length === 0) return null

  return (
    <span className="flex flex-wrap items-center gap-1">
      {reactions.map((one) =>
        one.mayPress ? (
          <Press
            key={one.content}
            said={one.mine ? `Take your ${one.content} back` : `React with ${one.content}`}
            onPress={onPress}
            press={{ kind: "react", on, id, content: one.content }}
          >
            <span className={one.mine ? "font-semibold text-ink" : undefined}>
              {one.emoji} {one.count}
            </span>
          </Press>
        ) : (
          <span
            key={one.content}
            className="rounded px-1.5 py-0.5 text-xs text-ink-muted"
            title={one.content}
          >
            {one.emoji} {one.count}
          </span>
        )
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
  onPress,
  onAsk
}: {
  readonly said: Reply
  /** The discussion's own address, so a permalink to this comment can be written. */
  readonly where: string
  /** Whether to say out loud that this is the marked Answer. */
  readonly marked?: boolean
  readonly onPress?: Pressing
  readonly onAsk?: Asking
}) => {
  const age = ageOf(said.at)

  /*
   * A comment a moderator folded away. GitHub serves their sentence for it and nothing else, so
   * the sentence is what is drawn: an empty row with a name and no words would read as something
   * this screen failed to load.
   */
  if (said.hiddenAs !== "") {
    return (
      <div className="px-3 py-2 text-xs text-ink-muted italic">
        {said.hiddenAs} <a className="not-italic text-ink-accent no-underline hover:underline" href={`${where}#discussioncomment-${said.id}`}>Show on GitHub</a>
      </div>
    )
  }

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
        <More on="DiscussionComment" id={said.id} onAsk={onAsk} onPress={onPress} />
      </div>
      <div className="mt-1 text-sm">
        <GitHubHtml html={said.body} />
      </div>
      <div className="mt-1">
        <Faces
          reactions={said.reactions}
          on="DiscussionComment"
          id={said.id}
          onPress={onPress}
        />
      </div>
    </div>
  )
}

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
  onPress,
  onAsk
}: {
  readonly comment: Comment
  readonly where: string
  readonly onPress?: Pressing
  readonly onAsk?: Asking
}) => (
  <li className="border-t border-edge first:border-t-0">
    <Said
      said={comment}
      where={where}
      marked={comment.isAnswer}
      onPress={onPress}
      onAsk={onAsk}
    />
    {comment.replies.length === 0 ? null : (
      <ul className="ml-6 list-none border-l border-edge">
        {comment.replies.map((reply) => (
          <li key={reply.id}>
            <Said
              said={reply}
              where={where}
              marked={reply.isAnswer}
              onPress={onPress}
              onAsk={onAsk}
            />
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
  onPress,
  onAsk
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
  /**
   * How their own menu is asked for, or nothing on a screen that only reads.
   *
   * Apart from {@link onPress} because it happens at a different moment: the menu is read when
   * somebody opens it and the form in it is sent when they press one of its entries.
   */
  readonly onAsk?: Asking
}) => {
  const answering = answeringOf(weighingOf(snapshot))
  const said = ANSWERING_SAID[answering]
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
            <span className={`text-xs font-semibold ${ANSWERING_TONE[answering]}`}>{said}</span>
          )
        }
      >
        <div className="flex flex-wrap items-baseline gap-2 px-3 pt-2 text-xs text-ink-muted">
          <span className="tabular-nums">{`#${snapshot.reference.number}`}</span>
          <a
            className="text-ink-muted no-underline hover:underline"
            href={listAddressOf(snapshot.reference.home, Option.some(snapshot.category.slug))}
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
          <More on="Discussion" id={snapshot.id} onAsk={onAsk} onPress={onPress} />
        </div>
        {/* Folded, because a body of three hundred lines puts the answer a screen below it,
            and on this page the answer is what somebody came for. `vercel/next.js` #70178 is
            700 pixels of question before the first reply. */}
        <div className="text-sm">
          <Folded>
            <GitHubHtml html={snapshot.body} />
          </Folded>
        </div>
        <div className="px-3 pb-2">
          <Faces
            reactions={snapshot.reactions}
            on="Discussion"
            id={snapshot.id}
            onPress={onPress}
          />
        </div>
      </Section>

      {Option.isSome(snapshot.poll) ? (
        <Voting poll={snapshot.poll.value} onPress={onPress} />
      ) : null}

      {Option.isSome(answer) ? (
        <Section name="The answer" tone="done" art="tick">
          <Said said={answer.value} where={where} onPress={onPress} onAsk={onAsk} />
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
          <Said said={likely.value} where={where} onPress={onPress} onAsk={onAsk} />
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
              <Spoken
                key={comment.id}
                comment={comment}
                where={where}
                onPress={onPress}
                onAsk={onAsk}
              />
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
