/**
 * What the keyboard can ask for, and which keys ask for it.
 *
 * One table, read by two things: the matcher that turns a keypress into a
 * command, and the components that answer commands. The cap a button wears
 * comes out of the same table, so the letter on the face of a control and the
 * letter that works are the same letter by construction.
 */

/**
 * Everything the keyboard can ask for. Deliberately short.
 *
 * The Destinations are named here as they are named everywhere else rather than
 * as `goHome` and its siblings: a second word for the same thing is how a
 * vocabulary starts drifting, and the command is the Destination.
 */
export type Command =
  | "nextFile"
  | "previousFile"
  | "markFile"
  | "reviewMode"
  | "openAside"
  | "search"
  | "dismiss"
  | "workingSet"
  | "repositories"
  | "activity"
  | "home"

/**
 * Whose keys these are.
 *
 * The same commands throughout — a profile changes which keys reach them, never
 * what they do. `off` exists because this interface lives inside GitHub's page,
 * and someone who has spent years on GitHub's own shortcuts should be able to
 * have them back untouched.
 */
export type Profile = "standard" | "vim" | "off"

export const DEFAULT_PROFILE: Profile = "standard"

/**
 * The unmodified key as the browser reports it: `j`, `/`, `?`, `Escape`.
 *
 * Two keys pressed one after the other are one chord with a space between them,
 * `g d`, which is how a reader says it out loud. Keeping a sequence in the same
 * string as a single key means the matcher, the sheet and the cap on a button
 * all read one table, and only the matcher has to know that sequences exist.
 */
export type Chord = string

type Table = Readonly<Record<Command, ReadonlyArray<Chord>>>

/**
 * Editor letters, plus the pair a reader who has never touched vim will try.
 *
 * `j` and `k` because every list on this page is read the way a file is, and
 * `n` and `p` because "next" and "previous" is what someone guesses when `j`
 * means nothing to them. Both cost one letter each and there is no shortage.
 *
 * The Destinations go behind `g` because `g d` is what Participants press for
 * their dashboard today and said so in as many words, and hands that already
 * know that prefix should find the rest of these where they reach for them.
 * `g f` for Activity rather than `g a`, since the feed is what GitHub's own
 * address for it says and `a` is worth keeping free.
 */
const STANDARD: Table = {
  nextFile: ["j", "n"],
  previousFile: ["k", "p"],
  /*
   * `x`, which is the letter GitHub's own keyboard help gives this and the one
   * Refined GitHub added it to the file list under. Two interfaces that a
   * reviewer may have used before this one agree on it, so there is nothing to
   * be gained by choosing differently.
   */
  markFile: ["x"],
  /*
   * `r` for review, and it goes both ways: pressed outside the mode it opens it,
   * pressed inside it closes it. Escape closes it as well and always did, but
   * Escape is the way out of everything and says nothing about what this is.
   *
   * The letter is free on this page. GitHub gives `r` to quoting a reply, which
   * only happens with text selected inside a comment box, and this layer does
   * not read a press made while the reader is typing. `g r` is Repositories and
   * stays that way: a sequence half typed is read before a key on its own.
   */
  reviewMode: ["r"],
  /*
   * The capital, which is to say O with shift held. Written as the key the
   * browser reports rather than as a modifier and a letter, the same way `?` is
   * one key here: see `commandFor`.
   *
   * O for open, and shifted because Enter already opens the row the walk is on —
   * this is the same act with somewhere else to put it. Both the letter and the
   * shift are Refined GitHub's, whose readers walk lists with the same `j` and
   * `k` this one does.
   */
  openAside: ["O"],
  search: ["/"],
  dismiss: ["Escape"],
  workingSet: ["g d"],
  repositories: ["g r"],
  activity: ["g f"],
  home: ["g h"]
}

/**
 * The same commands, with the letters vim has other plans for left alone.
 *
 * `n` and `N` are search repetition in vim and will be exactly that here once
 * there is a search to repeat, so they are not spent on moving between files.
 * The Destinations keep their sequences: `g` is a prefix in vim as well, so
 * nothing about them reads wrongly to someone who lives in one.
 */
const VIM: Table = {
  nextFile: ["j"],
  previousFile: ["k"],
  markFile: ["x"],
  // `r` replaces a character in vim and waits for the character. Nothing here
  // waits for a second key, so there is no habit of vim's to keep clear of.
  reviewMode: ["r"],
  openAside: ["O"],
  search: ["/"],
  dismiss: ["Escape"],
  workingSet: ["g d"],
  repositories: ["g r"],
  activity: ["g f"],
  home: ["g h"]
}

const NOTHING: Table = {
  nextFile: [],
  previousFile: [],
  markFile: [],
  reviewMode: [],
  openAside: [],
  search: [],
  dismiss: [],
  workingSet: [],
  repositories: [],
  activity: [],
  home: []
}

export const bindings = (profile: Profile): Table =>
  profile === "vim" ? VIM : profile === "off" ? NOTHING : STANDARD

/**
 * Whether holding the key down may ask for this again, and again.
 *
 * Moving does and nothing else does. A key held down is one press to the reader
 * and thirty a second to the page, which is what they want from `j` — the list
 * spins past under one finger — and is never what they want from anything that
 * opens, closes or sends: a leaned-on `/` would fight the search box it just
 * put up, and a leaned-on `g h` would ask for Home while Home was arriving.
 *
 * Named after what the hand is doing rather than after a property of the
 * command, because the question is only ever asked about a key being held.
 */
export const heldDown = (command: Command): boolean =>
  command === "nextFile" || command === "previousFile"

/**
 * The one chord a button can wear on its face, or nothing when the command is
 * unbound.
 *
 * The first of them, where a command answers to several: a button has room for
 * one cap, and the first is the one worth learning. A reader with the keyboard
 * off is promised nothing, because they would press it and nothing would
 * happen.
 */
export const chordFor = (profile: Profile, command: Command): Chord | null =>
  bindings(profile)[command][0] ?? null
