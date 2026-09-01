import { COURT_NAME } from "../courts"

/**
 * What a reader is told the first time, in the order it is worth telling.
 *
 * A welcome, then a screen at a time, one sentence each. This is read by somebody who has
 * just installed something and wants to get on with their work: the product explains
 * itself once they are inside it, and every sentence here is a sentence between them and
 * that.
 *
 * Shared, because the same ones are said in two places now: the app's first window and
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

/**
 * The first heading a reader will see on the list, taken from the list itself.
 *
 * The first beat names it, and naming it is the whole beat: a reader who has read the
 * words "Needs You" here recognises the heading thirty seconds later and needs nothing
 * else explained. Written out again instead, this sentence promised a heading the app
 * had stopped drawing under that name.
 */
const FIRST_COURT = COURT_NAME["needs-you"]

export type Beat = {
  readonly title: string
  /** One sentence. Two is a beat that has started explaining itself. */
  readonly says: ReadonlyArray<string>
  /** What stands above the words. Both hosts mount the real screen and run it. */
  readonly picture?: Shot
}

export const BEATS: ReadonlyArray<Beat> = [
  /*
   * The welcome, greeting a reader over the product rather than over a logo.
   *
   * The same screen as the beat after it, on purpose, and this is the third answer to
   * what belongs here. A greeting on its own left a card that read as still loading. A
   * greeting under the mark was a splash screen: it costs a press and shows nothing, and
   * nothing is what a reader who has just installed something has the least patience for.
   * So the first thing on screen is the thing they installed, and the words in front of it
   * are the sentence they arrived with — the site's own, word for word.
   *
   * The picture is keyed by the screen rather than by the beat, so pressing Next here
   * leaves the list exactly where it is and only the words change.
   */
  {
    title: "Welcome to GitQuiet.",
    says: ["A faster, quieter GitHub."],
    picture: "working-set"
  },
  {
    title: "Every pull request you are in, in one list.",
    says: [`${FIRST_COURT} at the top. Nothing to sort and nothing to configure.`],
    picture: "working-set"
  },
  {
    title: "One pull request, one screen.",
    says: ["The conversation and the files together, with nothing unresolved hidden in a tab."],
    picture: "pull-request"
  },
  {
    title: "On github.com, not beside it.",
    says: ["Commits, issues, checks and releases, on the pages you already use."],
    picture: "commit"
  }
]
