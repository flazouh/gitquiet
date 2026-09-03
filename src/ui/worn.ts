/**
 * How long this interface goes on showing a change GitHub has not said back.
 *
 * Four screens hold one of these. The Working Set, the merge card and a run hold
 * theirs through `useLive`; an issue's header, the inbox and the star hold their
 * own, because each is a press against a read that is not a list and the shapes
 * have nothing in common. What they do have in common is the rule, and the rule
 * is worth having in one place: a change is worn until the read agrees, and given
 * up on after this.
 *
 * The cap is not the policy. Agreement is what normally takes a change off, and
 * this only covers the change that never gets its yes — a pull request somebody
 * reopened from another tab, a run that failed to cancel in a way GitHub never
 * reported. Without it a press made an hour ago would overrule every read after
 * it, which is the failure the other way round and the worse one, because nothing
 * would ever correct it.
 *
 * Five minutes because of what the reads are. GitHub's page data is behind a
 * write by a second or two; their search index, which the Working Set is read
 * from, is behind by minutes on a busy morning. A window shorter than the slower
 * of the two is a window that expires into a wrong answer.
 */
export const WEARING = 5 * 60_000

/** Whether a change made at this moment has been worn long enough. */
export const wornOut = (at: number, now: number = Date.now()): boolean => now - at > WEARING
