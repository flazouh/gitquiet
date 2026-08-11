import type { Stat } from "../domain/commitList"

/**
 * How big a commit is, counted out of the diff itself.
 *
 * GitHub knows the answer and will not say it in a list. Their own commit page
 * carries `{additions, deletions, filesChanged}` at the top of a payload that is
 * a hundred and thirty kilobytes of rendered patch, and no parameter trims it;
 * their deferred route, which exists precisely to fill in what a commit row is
 * missing, sends checks and signatures and not this. So the numbers are counted
 * here, from `/commit/SHA.diff`, which is the same commit as text at a seventh
 * of the weight.
 *
 * Read as a small state machine rather than by matching lines, because a diff's
 * two file headings begin with the characters a moved line begins with. `--- a/x`
 * and `+++ b/x` sit outside every hunk and a moved line sits inside one, which is
 * the only reliable way to tell them apart: a patch may legitimately contain a
 * line reading `+++ something`, and a regular expression written against the
 * three characters counts the heading of every file as a line and reads five
 * files as five additions heavier than they are.
 */
export const statIn = (diff: string): Stat => {
  let files = 0
  let added = 0
  let removed = 0
  let inHunk = false

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      files += 1
      inHunk = false
      continue
    }

    if (line.startsWith("@@")) {
      inHunk = true
      continue
    }

    // Everything between the two is git talking about the file — its mode, its
    // blob ids, its rename, its binary payload — and none of it is a line the
    // commit moved.
    if (!inHunk) continue

    if (line.startsWith("+")) added += 1
    else if (line.startsWith("-")) removed += 1
  }

  return { files, added, removed }
}
