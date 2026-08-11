import type { Participant, ReviewThread } from "./PullRequest"

/**
 * Everyone who spoke in a thread, once each, in the order they first did.
 *
 * A thread where one person wrote four times is one person, and counting a
 * speaker per comment would say the opposite.
 */
export const speakersIn = (thread: ReviewThread): ReadonlyArray<Participant> => {
  const seen = new Map<string, Participant>()
  for (const comment of thread.comments) {
    if (!seen.has(comment.author.login)) seen.set(comment.author.login, comment.author)
  }
  return [...seen.values()]
}

/**
 * What still wants an answer, above what does not.
 *
 * Stable within each half, so the order GitHub sent them in survives — which
 * for review threads is the order they were opened.
 */
export const unansweredFirst = (
  threads: ReadonlyArray<ReviewThread>
): ReadonlyArray<ReviewThread> =>
  [...threads].sort((one, other) => Number(one.isResolved) - Number(other.isResolved))
