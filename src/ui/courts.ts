import type { Court } from "../domain/workingSet"
import type { ArtName } from "./art"
import type { Tone } from "./Section"
import type { Answering } from "../domain/discussions"

/**
 * CONTEXT.md's four Courts, in the words it names them by.
 *
 * One word each for the last three, and that is the point of them: Waiting means
 * a person owes the next step, Running means a machine does. The heading they
 * replaced said "Waiting On Others" over both, and over a stranger's pull request
 * nobody was waiting on at all.
 *
 * Their own file because two screens name them now. The Working Set sorts pull
 * requests across repositories into these four, and the panel at the top of one
 * pull request sorts that pull request's own pieces into the same four. They are
 * one idea at two sizes, and a reader who learns the words on the list has
 * learnt them for the pull request as well — which only holds while there is one
 * place the words come from.
 */
export const COURT_NAME: Record<Court, string> = {
  "needs-you": "Needs You",
  waiting: "Waiting",
  running: "Running",
  settled: "Settled"
}

/**
 * What each Court means, in one sentence, for a reader who has never seen the list.
 *
 * Said twice before this existed: once on the page that sells the app and once in the
 * window that opens it, thirty seconds apart, in wording that had already begun to
 * differ. They are the same four sentences either way, so they are written once.
 *
 * Who owes the next step, in every one of them. That is the only idea the list rests
 * on, and a reader who has it can read the whole screen without being shown around it.
 */
export const COURT_MEANS: Record<Court, string> = {
  "needs-you": "You can act on it now.",
  waiting: "Someone else has to act.",
  running: "A machine is still working. Nothing to do but wait.",
  settled: "Finished. Nothing left to do."
}

/**
 * The colour a Court's heading wears.
 *
 * Amber for Needs You rather than red, and this is the whole rule the palette
 * runs on: red is kept for something broken. A pull request can be the reader's
 * to move *and* have a failing check, and if both are red the reader has to open
 * it to find out which. Purple for Settled because purple is already GitHub's
 * word for merged, so it needs no legend.
 */
export const COURT_TONE: Record<Court, Tone> = {
  "needs-you": "attention",
  waiting: "plain",
  // Plain as well, and deliberately the same. The two middle Courts differ in who
  // owes the next step, not in how much they matter, and a fourth colour on this
  // page would be a legend to learn for a distinction the words already draw.
  running: "plain",
  settled: "done"
}

/**
 * The glyph a Court's header wears, which is the same four sentences the names say.
 *
 * A hand for the reader's own move, a clock for what is with a person, the check glyph
 * for what a machine is still doing, a tick for what is done. They are worth drawing
 * because this page is scanned rather than read: the headers are what the eye lands on
 * first, and a shape is recognised before a word.
 *
 * Running borrows the check rollup's own glyph rather than a second clock. The rows under
 * it are the rows wearing that mark, so the heading is the same statement made larger.
 */
export const COURT_ART: Record<Court, ArtName> = {
  "needs-you": "needs-you",
  waiting: "clock",
  running: "check-running",
  settled: "tick"
}

/**
 * The same four glyphs, with the one that moves made to earn it.
 *
 * A turning circle says a machine is working right now. The Court says only that
 * a machine has the next move, and the two come apart on a pull request whose
 * checks have all passed and whose Running holds an answered finding: nothing is
 * queued, nothing is coming back, and the heading turned all the same. Found on
 * `octo-org/octo-repo#1787`, where it turned over fourteen green checks.
 *
 * At rest it borrows the dot a queued check wears, which is the distinction
 * `checkArt` already draws for a row: running and queued are not the same wait,
 * one is happening and the other has not started. A Court nothing is running in
 * is the second kind, so the heading is the row's own answer made larger — which
 * is what the turning circle was borrowed for in the first place.
 */
export const courtArt = (court: Court, moving: boolean): ArtName =>
  court === "running" && !moving ? "check-queued" : COURT_ART[court]

/**
 * The word a discussion wears for how far along its answer is.
 *
 * Here for the same reason the Courts above are: two screens name them now. The list writes it on
 * every row and the discussion itself writes it at the top, and a reader who learns the word on
 * one has learnt it for the other, which only holds while there is one place the word comes from.
 *
 * Unanswerable says nothing at all. A discussion in a category GitHub does not mark answers in is
 * not unanswered; there is no answer to be had, and a blank is the honest word for that.
 */
export const ANSWERING_SAID: Record<Answering, string> = {
  stale: "Stale",
  unanswered: "Unanswered",
  answered: "Answered",
  unanswerable: ""
}

/**
 * The colour each of those words wears, and there are only two.
 *
 * Stale is the busy colour the Needs You heading above it already wears, so the row and its
 * heading make one statement rather than two. Everything else is muted: an unanswered question
 * nobody has replied to is not a fault, and an answered one needs no emphasis to be found, since
 * the heading it sits under has already said it.
 */
export const ANSWERING_TONE: Record<Answering, string> = {
  stale: "text-busy",
  unanswered: "text-ink-muted",
  answered: "text-done",
  unanswerable: ""
}
