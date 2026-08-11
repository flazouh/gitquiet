import { bindings, type Chord, type Command, type Profile } from "./commands"

/** A keypress, reduced to the part a binding is allowed to care about. */
export type Press = {
  readonly key: string
  readonly ctrl?: boolean
  readonly meta?: boolean
  readonly alt?: boolean
  readonly shift?: boolean
}

/** A sequence half typed: the key that opened it, and when that key landed. */
export type Waiting = { readonly leader: Chord; readonly at: number } | null

/**
 * What a press amounts to, and what the press after it is read against.
 *
 * The second half is the whole reason this is not a function of one keypress:
 * `g` on its own asks for nothing and yet changes what `d` means, so a reader
 * of this answer has to carry it to the next press.
 */
export type Reading = {
  readonly command: Command | null
  readonly waiting: Waiting
}

/**
 * How long a half-typed sequence is still worth finishing.
 *
 * A second and a half, which is what GitHub's own sequences on this same page
 * give a reader — and the reader here is that reader, so a shorter window would
 * make `g r` unreliable for anyone who types it as two deliberate presses.
 * Short enough that a `g` pressed by mistake is forgotten well before the next
 * real press, and passed in rather than read off the clock so that a test can
 * say "later" without waiting.
 */
export const PATIENCE = 1500

/**
 * Whether the browser or the operating system has first claim on the press.
 *
 * Exported for the letters a menu answers to, which are read against the same
 * rule: whatever this says belongs to the reader's own keyboard is not something
 * this interface may take, whichever layer is doing the taking.
 */
export const theirs = (press: Press): boolean =>
  press.ctrl === true || press.meta === true || press.alt === true

/**
 * Whether the press is a modifier being held rather than a key being typed.
 *
 * Each of them arrives as a keypress of its own, and shift is how a reader
 * reaches half the keys on the board: a sequence that counted one as its second
 * half would be unfinishable by anyone typing a shifted letter.
 */
const holding = (key: string): boolean =>
  key === "Shift" || key === "Control" || key === "Alt" || key === "Meta"

/**
 * The command answering to a chord, among those anyone is listening for.
 *
 * `answered` is asked before the chords are, because a command nobody on this
 * screen has claimed is not a reason to take a key out of GitHub's hands.
 */
const answering = (
  profile: Profile,
  wanted: (chord: Chord) => boolean,
  answered: (command: Command) => boolean
): Command | null => {
  for (const [name, chords] of Object.entries(bindings(profile))) {
    const command = name as Command
    if (answered(command) && chords.some(wanted)) return command
  }
  return null
}

/**
 * The command a keypress asks for on its own, or nothing.
 *
 * Anything held with Command, Control or Alt is left alone without even
 * looking: those belong to the browser and to the operating system, and a
 * single-letter shortcut that also fires on Cmd+J is a shortcut that breaks
 * jumping to a tab. Shift is not treated that way — `?` is a shifted key and
 * arrives as `?`, so the key itself already says whether shift was down.
 */
export const commandFor = (press: Press, profile: Profile): Command | null =>
  theirs(press) ? null : answering(profile, (chord) => chord === press.key, () => true)

/**
 * What a keypress asks for, read against whatever key was pressed before it.
 *
 * A sequence is given exactly one key to finish in, and the press after it
 * starts fresh whether it finished or not: a leader pressed by mistake costs
 * the one press following it and nothing else, which is the same bargain
 * GitHub's own sequences offer. That press is not taken out of the air either,
 * so whatever else was listening for it still hears it.
 */
export const read = (
  press: Press,
  profile: Profile,
  waiting: Waiting,
  answered: (command: Command) => boolean,
  now: number = Date.now()
): Reading => {
  // Neither answers nor cancels: a press this layer has no claim on should not
  // cost a reader the sequence they are in the middle of typing.
  if (theirs(press) || holding(press.key)) return { command: null, waiting }

  if (waiting !== null && now - waiting.at <= PATIENCE) {
    const wanted = `${waiting.leader} ${press.key}`
    return { command: answering(profile, (chord) => chord === wanted, answered), waiting: null }
  }

  const alone = commandFor(press, profile)
  if (alone !== null) return { command: alone, waiting: null }

  const opens = answering(profile, (chord) => chord.startsWith(`${press.key} `), answered)
  return { command: null, waiting: opens === null ? null : { leader: press.key, at: now } }
}
