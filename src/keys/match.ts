import {
  bindings,
  isCombo,
  keyOfCombo,
  type Chord,
  type Command,
  type Keys
} from "./commands"

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
  keys: Keys,
  wanted: (chord: Chord) => boolean,
  answered: (command: Command) => boolean
): Command | null => {
  for (const [name, chords] of Object.entries(bindings(keys))) {
    const command = name as Command
    if (answered(command) && chords.some(wanted)) return command
  }
  return null
}

/**
 * Whether a Cap-style combo chord (`⌘b`, `⌘⇧b`) is exactly this press.
 *
 * `⌘` is Command on a Mac and Control elsewhere — the same rule the palette's
 * ⌘K listener keeps. Shift in the chord demands shift on the press; a chord
 * without it refuses a shifted press, so `⌘b` and `⌘⇧b` stay two answers.
 * The letter is compared without case when shift is held, because the browser
 * reports `B` for Shift+B and the table writes the letter Cap shows.
 */
const comboMatches = (chord: Chord, press: Press): boolean => {
  if (!isCombo(chord) || chord.includes(" ")) return false

  const wantMod = chord.includes("⌘")
  const wantShift = chord.includes("⇧")
  const wantAlt = chord.includes("⌥")
  const wantCtrl = chord.includes("⌃")
  const key = keyOfCombo(chord)
  if (key.length === 0) return false

  const modHeld = press.meta === true || press.ctrl === true
  if (wantMod !== modHeld) return false
  if (wantCtrl && press.ctrl !== true) return false
  if (wantAlt !== (press.alt === true)) return false
  if (wantShift !== (press.shift === true)) return false

  return wantShift
    ? press.key.toLowerCase() === key.toLowerCase()
    : press.key === key
}

/**
 * The command a keypress asks for on its own, or nothing.
 *
 * Anything held with Command, Control or Alt is left alone unless a combo
 * chord in the table asked for that hold — `⌘b` is ours, `⌘s` is still the
 * browser's. A single-letter shortcut that also fired on Cmd+J would break
 * jumping to a tab; the combo grammar is the deliberate exception. Shift is
 * not treated as "theirs" on its own — `?` is a shifted key and arrives as
 * `?`, so the key itself already says whether shift was down.
 */
export const commandFor = (press: Press, keys: Keys): Command | null => {
  if (holding(press.key)) return null
  if (theirs(press)) {
    return answering(keys, (chord) => comboMatches(chord, press), () => true)
  }
  return answering(
    keys,
    (chord) => !isCombo(chord) && !chord.includes(" ") && chord === press.key,
    () => true
  )
}

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
  keys: Keys,
  waiting: Waiting,
  answered: (command: Command) => boolean,
  now: number = Date.now()
): Reading => {
  // A modifier held on its own is not a key being typed.
  if (holding(press.key)) return { command: null, waiting }

  // Combo chords (`⌘b`) answer on their own and never continue a sequence.
  // A Command/Control/Alt press that matches nothing of ours is left alone
  // without cancelling a half-typed `g …` — same bargain as before for keys
  // that belong to the browser.
  if (theirs(press)) {
    const command = answering(keys, (chord) => comboMatches(chord, press), answered)
    return { command, waiting: command === null ? waiting : null }
  }

  if (waiting !== null && now - waiting.at <= PATIENCE) {
    const wanted = `${waiting.leader} ${press.key}`
    return { command: answering(keys, (chord) => chord === wanted, answered), waiting: null }
  }

  const alone = commandFor(press, keys)
  if (alone !== null) return { command: alone, waiting: null }

  const opens = answering(keys, (chord) => chord.startsWith(`${press.key} `), answered)
  return { command: null, waiting: opens === null ? null : { leader: press.key, at: now } }
}
