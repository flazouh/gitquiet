/**
 * Words that were typed and not yet sent.
 *
 * The one thing on any screen here that GitHub has no copy of. Every read can be made
 * again; a paragraph somebody wrote and lost is gone, and losing one is the complaint people
 * have about every comment box on the web. This extension makes it worse than most if it
 * does nothing: a press moves between screens, and each screen is its own bundle with its
 * own React tree, so leaving a page is the same as closing a tab as far as a box is
 * concerned.
 *
 * So the box writes through to `localStorage` on every keystroke, under the subject it is
 * about, and reads back from it when it next stands up. Synchronous on purpose, the same
 * reason `keptRepositories.ts` is: the box is drawn in the first render, and a box that
 * filled itself in a tick later would take a keystroke with it.
 */

import { UndefinedOr } from "effect"
import { HELD } from "./keeping"

/**
 * Storage that cannot throw.
 *
 * A private window, a profile with storage off, and a spent quota all reach here, and all
 * three mean the same thing: nothing is kept, and the box works as a box always did.
 */
const store = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((one: Storage, key: string) => one.getItem(key))
const write = UndefinedOr.liftThrowable((one: Storage, key: string, value: string) => {
  one.setItem(key, value)
})
const remove = UndefinedOr.liftThrowable((one: Storage, key: string) => {
  one.removeItem(key)
})

const keyed = (subject: string): string => `${HELD}${subject}`

/** What is waiting under this subject, or nothing. */
export const held = (subject: string): string => {
  const one = store()
  if (one === undefined) return ""

  return read(one, keyed(subject)) ?? ""
}

/**
 * Keeps what is in the box under this subject.
 *
 * A box emptied by hand is a draft withdrawn, so it is dropped rather than kept as an empty
 * string: `holding()` is what tells a reader they have words waiting somewhere, and a page
 * they typed a character into and rubbed out is not somewhere they left anything.
 */
export const hold = (subject: string, text: string): void => {
  const one = store()
  if (one === undefined) return

  if (text.trim() === "") {
    remove(one, keyed(subject))
    return
  }

  write(one, keyed(subject), text)
}

/** Drops what was under this subject, which is what posting it means. */
export const forget = (subject: string): void => {
  const one = store()
  if (one === undefined) return

  remove(one, keyed(subject))
}

/** Every subject with words waiting under it, by the name they were kept under. */
export const holding = (): ReadonlyArray<string> => {
  const one = store()
  if (one === undefined) return []

  const subjects: Array<string> = []
  for (let at = 0; at < one.length; at += 1) {
    const key = one.key(at)
    if (key !== null && key.startsWith(HELD)) subjects.push(key.slice(HELD.length))
  }

  return subjects
}
