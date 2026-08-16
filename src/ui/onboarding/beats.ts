/**
 * What a reader is told the first time, in the order it is worth telling.
 *
 * Four beats and no more. This is read by somebody who has just installed something
 * and wants to get on with their work, so each beat is one screen, one idea, and two
 * sentences at most. Everything else the product does is discoverable in the product.
 *
 * Shared, because the same four are said in three places now: the app's first window,
 * the page a reader lands on when the extension installs itself, and the site. Three
 * copies of the same explanation is three explanations, and they drift.
 *
 * The last beat belongs to the host rather than to this list. What a reader should do
 * next is the one thing that genuinely differs: sign in, in the app; add the
 * extension, on the site; open a pull request, once the extension is already there.
 */
export type Beat = {
  /** Used in the address and in the step's own key. Never read by anybody. */
  readonly id: string
  readonly title: string
  /** One or two sentences. A third is a beat that should have been two. */
  readonly says: ReadonlyArray<string>
  /**
   * Which screen is shown beside the words, by the name the captures are filed under.
   *
   * The host draws it: the site mounts the screen itself and runs it, the app and the
   * extension show the capture of it. Absent on a beat whose picture is the words.
   */
  readonly shot?: string
  /** Whether the four Courts are named under the words. True on exactly one beat. */
  readonly courts?: boolean
}

export const BEATS: ReadonlyArray<Beat> = [
  {
    id: "what",
    title: "GitQuiet redraws GitHub.",
    says: [
      "Fourteen pages on github.com are drawn again: a pull request, a commit, an issue, a failing check.",
      "Nothing leaves GitHub. Your reviews, comments and merges go through them exactly as before, and a colleague who never installed this sees your work as usual."
    ]
  },
  {
    id: "courts",
    title: "Is it my turn?",
    says: [
      "That is the question a list of pull requests never answers, so this one is built out of the answer.",
      "Everything you are involved in lands in one of four groups, by who has to act next."
    ],
    shot: "working-set",
    courts: true
  },
  {
    id: "card",
    title: "One pull request, one screen.",
    says: [
      "The conversation and the files are the same screen. There are no tabs to switch between and nothing to scroll past twice.",
      "Everything still unresolved sits above the diff, so you read the questions before you read the code."
    ],
    shot: "pull-request"
  },
  {
    id: "rest",
    title: "The same reading, everywhere else.",
    says: [
      "A commit, a failing Actions run, an issue, a release: the same screen, sorted by the same four groups.",
      "Nothing here needs setting up. Every choice already has an answer, and they are all in Settings when one of them is wrong for you."
    ],
    shot: "commit"
  }
]
