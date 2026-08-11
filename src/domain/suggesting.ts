/**
 * What a box offers while somebody types.
 *
 * Two triggers, both of which anybody who writes on GitHub already uses: `@` names a person
 * and `#` names an issue. Neither is guessable from a plain textarea, and both are the
 * difference between writing a comment here and going back to their page to write it.
 *
 * The rules are here rather than in the box because they are string questions: which word the
 * caret is in, which of a list starts with it, and what the text becomes once one is chosen.
 * The box's own job is the popup and the caret.
 */

/** A person who can be mentioned, as their suggester names them. */
export type Named = {
  readonly login: string
  /** Their own name where they gave one, because that is what a reader remembers. */
  readonly name: string
}

/** An issue or a pull request that can be referred to by number. */
export type Numbered = {
  readonly number: number
  readonly title: string
  readonly state: "open" | "closed"
}

export type One = Named | Numbered

/** Both lists a repository offers a box, read together because they are asked for together. */
export type Suggesting = {
  readonly people: ReadonlyArray<Named>
  readonly numbered: ReadonlyArray<Numbered>
}

/** Which trigger the caret is under, what has been typed after it, and where it starts. */
export type Asked = {
  readonly kind: "person" | "issue"
  readonly said: string
  /** Where the trigger itself sits, which is what a choice replaces from. */
  readonly from: number
}

const KIND = { "@": "person", "#": "issue" } as const

/**
 * A trigger only counts at the start of a word.
 *
 * An address holds an at sign and a colour holds a hash, and both are typed far more often
 * than either trigger is meant. So the character before the trigger has to be nothing, a
 * space, a line, or punctuation that opens something.
 */
const OPENS = /[\s([{<>"'-]/

/** What the caret is asking for, or nothing, which is most of the time. */
export const asking = (text: string, caret: number): Asked | undefined => {
  const before = text.slice(0, caret)

  for (const mark of ["@", "#"] as const) {
    const at = before.lastIndexOf(mark)
    if (at === -1) continue

    const ahead = at === 0 ? undefined : before[at - 1]
    if (ahead !== undefined && !OPENS.test(ahead)) continue

    const said = before.slice(at + 1)
    // A space ends the offer: by then the reader is writing a sentence, not a name.
    if (/\s/.test(said)) continue

    return { kind: KIND[mark], said, from: at }
  }

  return undefined
}

/** How many are offered at once, which is as many as can be read without scrolling. */
const ROOM = 8

const isNamed = (one: One): one is Named => "login" in one

const words = (one: One): string =>
  isNamed(one) ? `${one.login} ${one.name}` : `${one.number} ${one.title}`

const opening = (one: One): string => (isNamed(one) ? one.login : String(one.number))

/**
 * Which of them to offer, best first.
 *
 * Two ranks rather than a score: the ones whose own name starts with what was typed, then the
 * ones that merely hold it somewhere. Anybody typing `@alex` means `alex` before they mean
 * `not-alex`, and a list that buries the obvious answer is a list nobody reads to the end of.
 */
export const matching = <A extends One>(among: ReadonlyArray<A>, said: string): ReadonlyArray<A> => {
  const wanted = said.trim().toLowerCase()
  if (wanted === "") return among.slice(0, ROOM)

  const first: Array<A> = []
  const then: Array<A> = []

  for (const one of among) {
    if (opening(one).toLowerCase().startsWith(wanted)) first.push(one)
    else if (words(one).toLowerCase().includes(wanted)) then.push(one)
  }

  return [...first, ...then].slice(0, ROOM)
}

/** How a chosen one is written: `@login` or `#number`. */
export const chosen = (one: One): string =>
  isNamed(one) ? `@${one.login}` : `#${one.number}`

/**
 * The text with the chosen one written in, and where the caret goes.
 *
 * A space after it, because a mention is followed by more words every time and nobody has
 * ever wanted to type that space themselves.
 */
export const filled = (
  text: string,
  from: number,
  caret: number,
  said: string
): { readonly text: string; readonly caret: number } => ({
  text: `${text.slice(0, from)}${said} ${text.slice(caret)}`,
  caret: from + said.length + 1
})
