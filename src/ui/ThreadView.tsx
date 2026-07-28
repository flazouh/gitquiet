import { CheckIcon } from "@primer/octicons-react"
import { Option } from "effect"
import type { ReviewThread } from "../domain/PullRequest"
import { Markdown } from "./Markdown"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * What was said in a thread, whoever is asking.
 *
 * The same rows in the column and in the diff, because they are the same
 * remarks: a reader who has learnt to read one of them has learnt to read the
 * other, and two renderings of one thing drift apart the week after they are
 * written.
 */
export const ThreadComments = ({
  thread,
  flush = false
}: {
  readonly thread: ReviewThread
  /** Set where the surrounding row already supplies the padding and the edge. */
  readonly flush?: boolean
}) => (
  <div className="divide-y divide-line-muted">
    {thread.comments.map((comment, index) => (
      <article
        key={`${thread.id}:${index}`}
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
 * A thread as it appears in the diff, against the line it is about.
 *
 * Nothing is folded here. In the column a folded line is what keeps twenty
 * threads from being a wall; hung off its own line there is only ever one of
 * these on screen at a time, and folding it would mean a click to read the
 * remark the reader has just scrolled to.
 */
export const ThreadInDiff = ({ thread }: { readonly thread: ReviewThread }) => (
  // Flat, because the row this is portalled into is already a bordered,
  // padded surface hanging under the line. A box inside that box draws two
  // edges around one remark.
  <section aria-label={`Review thread ${thread.id}`}>
    {thread.isResolved ? (
      <p className="flex items-center gap-2 pb-1.5 text-xs text-ink-muted">
        <CheckIcon size={12} aria-label="Resolved" className="shrink-0 text-pass" />
        Resolved
      </p>
    ) : null}
    <div className={thread.isResolved ? "opacity-60" : ""}>
      <ThreadComments thread={thread} flush />
    </div>
  </section>
)
