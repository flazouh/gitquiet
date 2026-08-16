/**
 * What a reader is told the first time, in the order it is worth telling.
 *
 * Three beats, a screen each, one sentence each. This is read by somebody who has just
 * installed something and wants to get on with their work: the product explains itself
 * once they are inside it, and every sentence here is a sentence between them and that.
 *
 * Shared, because the same three are said in two places now: the app's first window and
 * the site, which is also the page a reader lands on when the extension installs
 * itself. Two copies of the same explanation is two explanations, and they drift.
 *
 * The last beat belongs to the host rather than to this list. What a reader should do
 * next is the one thing that genuinely differs: sign in, in the app; add the
 * extension, on the site; open a pull request, once the extension is already there.
 */

/**
 * The screens a beat can be about, by the name both hosts file them under.
 *
 * A union rather than a string, because the two hosts disagree about what a name
 * they do not have means: the app's build step refuses to package one it cannot find,
 * and the site draws nothing at all. Neither of them should ever be asked.
 */
export type Shot = "working-set" | "pull-request" | "commit"

export type Beat = {
  readonly title: string
  /** One sentence. Two is a beat that has started explaining itself. */
  readonly says: ReadonlyArray<string>
  /**
   * Which screen is shown beside the words.
   *
   * The host draws it: the site mounts the screen itself and runs it, the app shows
   * the capture of it. Absent on a beat whose picture is the words.
   */
  readonly shot?: Shot
}

export const BEATS: ReadonlyArray<Beat> = [
  {
    title: "Your pull requests, grouped by whose move it is.",
    says: ["Your move, waiting, running, settled. Nothing to sort and nothing to configure."],
    shot: "working-set"
  },
  {
    title: "One pull request, one screen.",
    says: ["The conversation and the files together, with everything unresolved above the diff."],
    shot: "pull-request"
  },
  {
    title: "The same reading everywhere else.",
    says: ["Commits, issues, checks and releases, on the pages you already use."],
    shot: "commit"
  }
]
