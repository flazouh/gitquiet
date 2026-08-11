/**
 * Which presses this extension answers itself, rather than leaving to GitHub's router.
 *
 * Written here beside the table of what each press reads, for the same reason that one
 * was: a decision buried in an event handler cannot be tested, and what matters about it
 * is the coverage. A page left out of this is not broken, it is slow — the press falls
 * through to their router, and their router is the slowest thing on the path.
 *
 * Measured on a press of a commit row on `oven-sh/bun/commits/main`: the address moved
 * 3,780ms after the press, and our screen took the page in the same five millisecond tick.
 * The commit itself was in the store and had been read 1,992ms before that. All of the
 * wait was theirs, and answering the press ourselves is what removes it.
 */

import type { Wanted } from "./screens"

/**
 * Whether a press of a link to `there`, made while reading `here`, is ours to answer.
 *
 * The shell asks one more thing of a pull request that this cannot: whether the press
 * landed on the part of a row that means the pull request rather than beside it. That
 * question is about a DOM node, so it stays where the nodes are.
 */
export const oursToOpen = (there: Wanted | null, here: Wanted | null): boolean => {
  if (there === null) return false

  /*
   * A commit inside a pull request is a panel rather than a page. Our own screen puts it
   * where the branch's files were, so the conversation, the checks and the review are all
   * still beside it; answering that press would take the reader off the pull request.
   */
  if (there === "commit") return here !== "pull-request"

  // Raising an issue is the one page here with nothing to read: no memory to open it from
  // and nothing to be quick about, so their own form arriving in their own time is fine.
  return there !== "raise"
}
