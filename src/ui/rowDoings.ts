import type { RowDoing } from "../domain/doable"
import type { Letter } from "../keys/letters"
import type { ArtName } from "./art"

/**
 * What each verb a row offers is called, drawn as, typed as, and said afterwards.
 *
 * One table per question and all of them here rather than inside the menu, which
 * is the same reason `whatStateAllows` is in the domain rather than in a
 * component: the menu is no longer the only thing that has an opinion about these
 * verbs. The toast says what landed, the item wears a key cap, and a letter typed
 * into the open menu asks for one of them — three readers of the same vocabulary,
 * and three places a sixth verb would have to be remembered.
 */

/** What each verb calls itself in a menu, where there is room for a sentence. */
export const WORD: Record<RowDoing, string> = {
  merge: "Squash and merge",
  close: "Close",
  markReady: "Mark ready for review",
  toDraft: "Convert to draft",
  reopen: "Reopen"
}

/**
 * What each verb is called once it has happened, which is not what the item says.
 *
 * A menu offers; a toast reports. "Squash and merge" on a sentence about
 * something that already merged reads as an offer to do it again, which is the
 * one thing the reader must not think while a way back is on the screen beside
 * it. Past tense and lower case, because the address goes in front:
 * `flazouh/octo-repo#12 merged`.
 */
export const SAID: Record<RowDoing, string> = {
  merge: "merged",
  close: "closed",
  markReady: "marked ready for review",
  toDraft: "converted to draft",
  reopen: "reopened"
}

/**
 * The key each verb answers to while the menu is open.
 *
 * The first letter of the verb, every one of them, which is the only scheme a
 * reader does not have to learn twice. `r` is safe on both sides of the draft
 * door because reopening and marking ready are never offered at once — a closed
 * pull request has no draft to mark and a draft is not closed.
 *
 * `d` is the draft door rather than a delete, there being nothing here to delete,
 * and `y` for the link is GitHub's own letter for copying an address on the page
 * this interface is standing on.
 */
export const LETTER: Record<RowDoing, Letter> = {
  merge: "m",
  close: "c",
  markReady: "r",
  toDraft: "d",
  reopen: "r"
}

/** The address on the clipboard, which is the one item that asks GitHub nothing. */
export const COPY_LETTER: Letter = "y"

/**
 * What each verb ends in, drawn and coloured as the state it leads to.
 *
 * Not a decoration. Every one of these turns a pull request into a state the
 * list already draws in the row's own left margin — merged, open, draft, closed
 * — so the item wears the glyph and the colour the row will wear once it lands.
 * A reader who knows the purple diamond means merged does not have to read
 * "Squash and merge" to know which item that is.
 *
 * Taken from the art set rather than imported, so a reader who has handed down
 * their own glyphs gets theirs here as well.
 */
export const LOOK: Record<RowDoing, { readonly art: ArtName; readonly tone: string }> = {
  merge: { art: "pull-request-merged", tone: "text-done" },
  markReady: { art: "pull-request", tone: "text-pass" },
  toDraft: { art: "pull-request-draft", tone: "text-ink-muted" },
  reopen: { art: "pull-request", tone: "text-pass" },
  close: { art: "pull-request-closed", tone: "text-fail" }
}

/**
 * How a verb looks once it is armed, which is now only the one that arms.
 *
 * The card fills its button with the tone it is about to act in, and this is
 * that sentence in a menu: an item the reader has already pressed once stops
 * looking like a list of choices and starts looking like the thing it will do.
 *
 * All five are still dressed, because a click still asks twice — the button
 * appears under a pointer in a list being scrolled, and a brush past it should
 * not mark somebody's pull request ready for review. A letter is the deliberate
 * press a click is not, so only merging arms when one is typed.
 */
export const ARMED: Record<RowDoing, string> = {
  merge: "bg-pass-emphasis text-ink-on-emphasis",
  close: "bg-fail-emphasis text-ink-on-emphasis",
  markReady: "bg-accent-emphasis text-ink-on-emphasis",
  toDraft: "bg-accent-emphasis text-ink-on-emphasis",
  reopen: "bg-pass-emphasis text-ink-on-emphasis"
}

/**
 * The order the verbs read in, which is not the order the domain lists them.
 *
 * What the reader came for first: landing it, then the draft door, then the two
 * that end or restart the conversation. Closing sits last and alone, because a
 * menu whose destructive item is under the cursor when it opens is a menu that
 * will eventually be pressed by accident.
 */
export const ORDER: ReadonlyArray<RowDoing> = ["merge", "markReady", "toDraft", "reopen", "close"]
