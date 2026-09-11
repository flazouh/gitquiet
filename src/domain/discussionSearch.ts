/**
 * The filter bar's own vocabulary, which is GitHub's search vocabulary.
 *
 * Its own file because it is a different job from the rest of discussions: nothing here knows
 * what a discussion is. A chip is a set of terms, a line of typing is a line of typing, and every
 * function is about moving terms in and out of that line.
 *
 * Terms and not a state of this screen's own, so that pressing a chip writes an address a reader
 * can copy, send and come back to, and so that GitHub does the filtering across every page rather
 * than this screen filtering the twenty-five rows it happens to hold.
 */
import { asked, termsIn, toggling } from "./sieve"

/**
 * One press of the filter bar, as the terms it puts in their own search.
 *
 * Terms and not a state of this screen's own, so that pressing one writes an address a reader
 * can copy, send and come back to, and so that GitHub does the filtering across every page
 * rather than this screen filtering the twenty-five rows it happens to hold.
 */
export type Chip = {
  readonly name: string
  /** Their own vocabulary, all of it put in together and all of it taken out together. */
  readonly terms: ReadonlyArray<string>
  /**
   * Chips that answer the same question, at most one of which can be on.
   *
   * Sorting is the plain case: `sort:top` and `sort:date_created` are two answers to one
   * question, and a line carrying both is a line GitHub reads the last of.
   */
  readonly group?: string
}

/**
 * The filter bar, in the order a reader asks these questions.
 *
 * Stale is the first of them and it is not a term GitHub has. It is two terms GitHub does have,
 * and the pairing is the whole point: `is:unanswered` alone is 98 of the 120 Questions counted
 * across eight repositories, and 94 of those already have somebody's reply in them. Adding
 * `comments:>0` cuts the 98 to the 94 that a person can finish by pointing at what is already
 * there — server-side, across every page, rather than over the twenty-five rows on this one.
 *
 * Measured on 2026-09-03 against `vercel/next.js`: `comments:0` answered rows whose counts were
 * all zero and `comments:>5` answered rows whose counts were all above five, so the qualifier is
 * real on this route and not merely accepted.
 */
export const CHIPS: ReadonlyArray<Chip> = [
  { name: "Stale", terms: ["is:unanswered", "comments:>0"], group: "answering" },
  { name: "Unanswered", terms: ["is:unanswered"], group: "answering" },
  { name: "Answered", terms: ["is:answered"], group: "answering" },
  { name: "Open", terms: ["is:open"], group: "standing" },
  { name: "Closed", terms: ["is:closed"], group: "standing" },
  { name: "Top", terms: ["sort:top"], group: "order" },
  { name: "Newest", terms: ["sort:date_created"], group: "order" }
]

/** Whether every term of a chip is already in the line, so the chip is on. */
export const asking = (typed: string, chip: Chip): boolean =>
  chip.terms.every((term) => asked(typed, term))

/**
 * The line with a chip pressed: all of its terms in, or all of them out.
 *
 * Pressing one on takes off whichever chip of the same group was on, because those are answers
 * to one question. Everything else the reader typed is left exactly where they typed it.
 */
export const toggled = (typed: string, chip: Chip): string => {
  if (asking(typed, chip)) {
    return chip.terms.reduce((line, term) => toggling(line, term), typed)
  }

  const others = CHIPS.filter(
    (one) => one !== chip && one.group !== undefined && one.group === chip.group
  )

  const cleared = others
    .flatMap((one) => one.terms)
    .reduce((line, term) => (asked(line, term) ? toggling(line, term) : line), typed)

  return chip.terms.reduce((line, term) => (asked(line, term) ? line : toggling(line, term)), cleared)
}

/**
 * Whatever the reader typed that is not one of the chips' terms.
 *
 * What the search box holds. Kept apart so that pressing a chip does not appear in the box as
 * text the reader has to delete by hand, and so that typing in the box does not take a chip off.
 */
export const wordsIn = (typed: string): string => {
  const owned = new Set(CHIPS.flatMap((chip) => chip.terms).map((term) => term.toLowerCase()))
  return termsIn(typed)
    .filter((term) => !owned.has(term.toLowerCase()))
    .join(" ")
}

/** The line with the reader's own words replaced and every chip left where it was. */
export const asWordsGo = (typed: string, words: string): string => {
  const owned = new Set(CHIPS.flatMap((chip) => chip.terms).map((term) => term.toLowerCase()))
  const chips = termsIn(typed).filter((term) => owned.has(term.toLowerCase()))

  return [...chips, ...termsIn(words)].join(" ")
}
