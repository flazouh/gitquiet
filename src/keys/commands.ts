/**
 * What the keyboard can ask for, and which keys ask for it.
 *
 * One table, read by three things: the matcher that turns a keypress into a
 * command, the components that answer commands, and the sheet that lists them
 * under `?`. Help that is generated from the bindings cannot drift from them,
 * which is the failure mode of every shortcut list written by hand.
 */

/** Everything the keyboard can ask for. Deliberately short. */
export type Command = "nextFile" | "previousFile" | "search" | "dismiss" | "help"

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

/** The unmodified key as the browser reports it: `j`, `/`, `?`, `Escape`. */
export type Chord = string

type Table = Readonly<Record<Command, ReadonlyArray<Chord>>>

/**
 * Editor letters, plus the pair a reader who has never touched vim will try.
 *
 * `j` and `k` because every list on this page is read the way a file is, and
 * `n` and `p` because "next" and "previous" is what someone guesses when `j`
 * means nothing to them. Both cost one letter each and there is no shortage.
 */
const STANDARD: Table = {
  nextFile: ["j", "n"],
  previousFile: ["k", "p"],
  search: ["/"],
  dismiss: ["Escape"],
  help: ["?"]
}

/**
 * The same five, with the letters vim has other plans for left alone.
 *
 * `n` and `N` are search repetition in vim and will be exactly that here once
 * there is a search to repeat, so they are not spent on moving between files.
 */
const VIM: Table = {
  nextFile: ["j"],
  previousFile: ["k"],
  search: ["/"],
  dismiss: ["Escape"],
  help: ["?"]
}

const NOTHING: Table = {
  nextFile: [],
  previousFile: [],
  search: [],
  dismiss: [],
  help: []
}

export const bindings = (profile: Profile): Table =>
  profile === "vim" ? VIM : profile === "off" ? NOTHING : STANDARD

/**
 * The one key a button can wear on its face, or nothing when the command is
 * unbound.
 *
 * The first of them, where a command answers to several: a button has room for
 * one cap, and the first is the one the sheet leads with and the one worth
 * learning. A reader with the keyboard off is promised nothing, because they
 * would press it and nothing would happen.
 */
export const chordFor = (profile: Profile, command: Command): Chord | null =>
  bindings(profile)[command][0] ?? null

/** In the order the sheet lists them, which is the order they are reached for. */
export const COMMAND_ORDER: ReadonlyArray<Command> = [
  "nextFile",
  "previousFile",
  "search",
  "dismiss",
  "help"
]

/** What each one is called in front of a reader. */
export const COMMAND_NAME: Readonly<Record<Command, string>> = {
  nextFile: "Next file",
  previousFile: "Previous file",
  search: "Filter the file tree",
  dismiss: "Close what is open",
  help: "This list"
}
