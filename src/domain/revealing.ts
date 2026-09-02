import type { ChangeType } from "./PullRequest"

/**
 * Which whole halves of a file have to be in hand before the lines between its
 * hunks can be revealed.
 *
 * GitHub sends a file's hunks and the three lines around each of them, and
 * everything else in the file is absent — so a remark on a line between two
 * hunks has nowhere to be drawn, and a reader who wants to say something about
 * the code just above a change cannot reach it. The renderer can draw the rest
 * once it has the file, and what it needs depends on what happened to the file.
 *
 * `both` is the ordinary case and the strict one. The renderer works the diff
 * out again from the two halves, so a half missing where one is needed is not a
 * smaller answer — it is a modified file redrawn as though the pull request had
 * added the whole of it. Better to reveal nothing.
 *
 * See `docs/plan/comment-anywhere.md`, step 3, and `CONTEXT.md`, Reveal.
 */
export type Halves = "both" | "after" | "nothing"

export const halvesToReveal = (change: ChangeType): Halves => {
  // Nothing was there before, so there is no old half to ask for and the
  // renderer is told so rather than left to guess from a failed read.
  if (change === "added") return "after"

  // Nothing is there now. There is no file to reveal the rest of.
  if (change === "deleted") return "nothing"

  return "both"
}
