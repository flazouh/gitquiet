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
 * The unmodified key as the browser reports it: `s`, `/`, `?`, `Escape`.
 *
 * Two keys pressed one after the other are one chord with a space between them,
 * `g d`, which is how a reader says it out loud. Keeping a sequence in the same
 * string as a single key means the matcher, the sheet and the cap on a button
 * all read one table, and only the matcher has to know that sequences exist.
 */
export type Chord = string

type Table = Readonly<Record<Command, ReadonlyArray<Chord>>>

/**
 * The chords a reader put on a command themselves, in place of the profile's.
 *
 * Partial, because most readers change nothing and an entry per command would
 * be a stored copy of a table this file already holds — one that would go on
 * answering with last year's letters after these tables moved on.
 */
export type Bound = Readonly<Partial<Record<Command, Chord>>>

/**
 * Whose keys these are, and whatever the reader has since changed.
 *
 * Carried as one value rather than as a profile beside a map, because every
 * component that answers a command needs both and neither means anything on its
 * own: a profile without the changes is the keys the reader replaced, and the
 * changes without a profile are three letters out of eleven.
 */
export type Keys = {
  readonly profile: Profile
  readonly bound: Bound
}

export const DEFAULT_KEYS: Keys = { profile: DEFAULT_PROFILE, bound: {} }

/** No keys at all, for a surface that is turning its own keyboard off. */
export const SILENT: Keys = { profile: "off", bound: {} }

/**
 * The left hand's letters, and nothing that needs the right one.
 *
 * The right hand is on the pointer for the whole of a review — scrolling the
 * diff, following a link, opening a thread — so a keyboard that only answers to
 * `j` and `k` is a keyboard that costs a reach for every press. Every default
 * here is reachable from the home row of the left hand alone.
 *
 * `w` and `s` for the two directions, which is where a hand already goes to move
 * up and down something, and the pair is worth more than the letters it spends:
 * they are the two presses of the whole review.
 *
 * The Destinations stay behind `g` because `g d` is what Participants press for
 * their dashboard today and said so in as many words, and `g` is under the same
 * hand. `g f` for Activity, since the feed is what GitHub's own address for it
 * says. `g g` for Home rather than `g h`: `h` is the right hand's index finger,
 * and a doubled leader is the one sequence a vim reader already types.
 */
const STANDARD: Table = {
  nextFile: ["s"],
  previousFile: ["w"],
  /*
   * `x`, which is the letter GitHub's own keyboard help gives this and the one
   * Refined GitHub added it to the file list under. Two interfaces that a
   * reviewer may have used before this one agree on it, so there is nothing to
   * be gained by choosing differently — and it is under the same hand already.
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
   * The capital, which is to say A with shift held. Written as the key the
   * browser reports rather than as a modifier and a letter, the same way `?` is
   * one key here: see `commandFor`.
   *
   * A for aside, and shifted because Enter already opens the row the walk is on
   * — this is the same act with somewhere else to put it. It was `O`, which is
   * Refined GitHub's letter for the same act; the shift is theirs and stays, and
   * the letter moves under the hand that is doing the walking.
   */
  openAside: ["A"],
  /*
   * `f` for find, which is the letter every editor and every browser gives this,
   * and `/` beside it for the reader whose hands learnt it on GitHub's own page.
   * The cap says `f`, because that is the one a left hand can reach.
   */
  search: ["f", "/"],
  dismiss: ["Escape"],
  workingSet: ["g d"],
  repositories: ["g r"],
  activity: ["g f"],
  home: ["g g"]
}

/**
 * The same commands, with the letters vim has other plans for left alone.
 *
 * `j` and `k` live here rather than in the standard set: they are the right
 * hand's home row, which is the whole reason the standard set moved off them,
 * and they are also the two letters a vim reader will try before any other.
 * Nobody has to choose between the two hands — the profile is the choice.
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

const tableFor = (profile: Profile): Table =>
  profile === "vim" ? VIM : profile === "off" ? NOTHING : STANDARD

/**
 * Every command in the order a reader meets them, and what each is called.
 *
 * Here rather than in the panel that draws the rows, for the reason the chords
 * are here: the panel is not the only thing that has to name a command, and a
 * second table of words somewhere else is the one that goes stale. The order is
 * the order of the review — move, mark, read — and then the places to go.
 */
export const KEYBOARD: ReadonlyArray<{
  readonly command: Command
  readonly word: string
  readonly gist: string
}> = [
  { command: "nextFile", word: "Next file", gist: "Down the rail to the file after this one" },
  {
    command: "previousFile",
    word: "Previous file",
    gist: "Back up the rail to the file before it"
  },
  { command: "markFile", word: "Mark file", gist: "Turn this file's mark over, read or unread" },
  { command: "reviewMode", word: "Review mode", gist: "The files on the whole screen, and back" },
  { command: "openAside", word: "Open aside", gist: "The row the walk is on, in the side panel" },
  { command: "search", word: "Search", gist: "The filter over whichever list is on screen" },
  { command: "dismiss", word: "Close", gist: "The way out of whatever is open" },
  { command: "workingSet", word: "Working set", gist: "Everything waiting on you" },
  { command: "repositories", word: "Repositories", gist: "The repositories you keep" },
  { command: "activity", word: "Activity", gist: "The feed" },
  { command: "home", word: "Home", gist: "The front of the interface" }
]

/**
 * Whether a chord is one a reader could have meant.
 *
 * A press this layer never reads is a binding that would look set and do
 * nothing, which is worse than a command with no key at all. Modifiers are the
 * browser's and the operating system's — see `theirs` in `match.ts` — and a
 * modifier held on its own is not a key being typed.
 */
export const isChord = (chord: Chord): boolean =>
  chord.length > 0 &&
  chord.length <= 16 &&
  chord.split(" ").every((press) => press.length > 0 && !HOLDING.has(press))

const HOLDING: ReadonlySet<string> = new Set(["Shift", "Control", "Alt", "Meta"])

/**
 * The profile's chords with the reader's own written over them.
 *
 * A command a reader has bound answers to that chord and to nothing else: the
 * point of changing a key is to know which key it is, and a default left
 * underneath would be a second answer nobody was told about.
 *
 * The chord is taken off every other command as it lands, because one chord
 * that asks for two things asks for whichever the matcher walks into first,
 * which is a table order rather than an answer. The command the reader just
 * bound is the one that keeps it — they are looking at it.
 *
 * `off` is answered before any of this: a reader who turned the keyboard off
 * turned off the keys they chose as well as the ones they were given.
 */
export const bindings = (keys: Keys): Table => {
  const table = tableFor(keys.profile)
  if (keys.profile === "off") return table

  const wanted = Object.entries(keys.bound).filter(
    (entry): entry is [Command, Chord] => typeof entry[1] === "string" && isChord(entry[1])
  )
  if (wanted.length === 0) return table

  const taken = new Set(wanted.map(([, chord]) => chord))
  const written = Object.fromEntries(
    Object.entries(table).map(([name, chords]) => [
      name,
      chords.filter((chord) => !taken.has(chord))
    ])
  ) as unknown as Record<Command, ReadonlyArray<Chord>>

  for (const [command, chord] of wanted) written[command] = [chord]
  return written
}

/**
 * Whether holding the key down may ask for this again, and again.
 *
 * Moving does and nothing else does. A key held down is one press to the reader
 * and thirty a second to the page, which is what they want from `s` — the list
 * spins past under one finger — and is never what they want from anything that
 * opens, closes or sends: a leaned-on `f` would fight the search box it just
 * put up, and a leaned-on `g g` would ask for Home while Home was arriving.
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
export const chordFor = (keys: Keys, command: Command): Chord | null =>
  bindings(keys)[command][0] ?? null
