import { type Press, theirs } from "./match"

/**
 * A single key a thing on top of the screen answers to while it is up.
 *
 * The other half of a Command, and deliberately not one of them. A command
 * belongs to the whole interface, is bound per profile, and is listed under `?`;
 * a letter belongs to whatever the reader has open — the verbs in a row's menu,
 * the choices in a dialogue — and means nothing a moment later when that thing
 * has closed. Both are typed by the same hands, so the cap on the item and the
 * key it answers to are still one string.
 */
export type Letter = string

/**
 * The letter a press amounts to, among those the thing on top is offering.
 *
 * Anything held with Command, Control or Alt is left alone: those are the
 * reader's own copy, bookmark and tab shortcuts, and a menu that closed a pull
 * request on Ctrl+C would be a menu nobody could copy out of. A shifted letter
 * is not the letter either — the item wears a small `c` on its face, and the
 * promise a cap makes is the whole reason the reader pressed anything.
 *
 * Nothing where nothing is offered, so the press stays in the air for the
 * menu's own typeahead and for whatever is underneath it.
 */
export const letterFor = (press: Press, offered: ReadonlyArray<Letter>): Letter | null =>
  theirs(press) ? null : (offered.find((letter) => letter === press.key) ?? null)
