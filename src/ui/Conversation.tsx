import { CheckCircleFillIcon, CommentDiscussionIcon } from "@primer/octicons-react"
import type { ReviewThread, ThreadComment } from "../domain/PullRequest"

export type ConversationProps = {
  readonly threads: ReadonlyArray<ReviewThread>
}

const Remark = ({ comment }: { readonly comment: ThreadComment }) => (
  <li className="flex flex-col gap-1 px-4 py-2">
    <span className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="font-semibold text-ink">{comment.author.login}</span>
      {comment.author.isAutomated ? <span className="Label">bot</span> : null}
    </span>
    <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
  </li>
)

const Thread = ({ thread }: { readonly thread: ReviewThread }) => {
  const Art = thread.isResolved ? CheckCircleFillIcon : CommentDiscussionIcon

  return (
    <section className="Box" aria-label={`Thread ${thread.id}`}>
      <div className="flex items-center gap-2 rounded-t-md border-b border-line bg-surface px-4 py-2">
        <Art className={`shrink-0 ${thread.isResolved ? "text-pass" : "text-ink-muted"}`} />
        <h3 className="text-sm font-semibold">
          {thread.isResolved ? "Resolved" : "Open"}
        </h3>
        <span className="Counter">{thread.comments.length}</span>
      </div>
      <ul className="divide-y divide-line-muted">
        {thread.comments.map((comment, index) => (
          <Remark key={`${thread.id}:${index}`} comment={comment} />
        ))}
      </ul>
    </section>
  )
}

export const Conversation = ({ threads }: ConversationProps) =>
  threads.length === 0 ? (
    <p className="px-4 py-2.5 text-sm text-ink-muted">Nothing said yet</p>
  ) : (
    <div className="flex flex-col gap-4">
      {threads.map((thread) => (
        <Thread key={thread.id} thread={thread} />
      ))}
    </div>
  )
