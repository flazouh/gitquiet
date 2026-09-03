import { Option } from "effect"
import {
  type Answering,
  type Comment,
  type DiscussionSnapshot,
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
  marked = false
}: {
  readonly said: Reply
  /** The discussion's own address, so a permalink to this comment can be written. */
  readonly where: string
  /** Whether to say out loud that this is the marked Answer. */
  readonly marked?: boolean
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
      </div>
      <div className="mt-1 text-sm">
        <GitHubHtml html={said.body} />
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
const Spoken = ({ comment, where }: { readonly comment: Comment; readonly where: string }) => (
  <li className="border-t border-edge first:border-t-0">
    <Said said={comment} where={where} marked={comment.isAnswer} />
    {comment.replies.length === 0 ? null : (
      <ul className="ml-6 list-none border-l border-edge">
        {comment.replies.map((reply) => (
          <li key={reply.id}>
            <Said said={reply} where={where} marked={reply.isAnswer} />
          </li>
        ))}
      </ul>
    )}
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
export const Discussion = ({ snapshot }: { readonly snapshot: DiscussionSnapshot }) => {
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

      {Option.isSome(answer) ? (
        <Section name="The answer" tone="done" art="tick">
          <Said said={answer.value} where={where} />
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
          <Said said={likely.value} where={where} />
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
              <Spoken key={comment.id} comment={comment} where={where} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
