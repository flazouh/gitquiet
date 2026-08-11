import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { KEPT_CARD, KEPT_ROWS, KEPT_SEEN } from "../../../src/ui/keeping"
import type { CardFacts, WorkingSetRow } from "../shared/wire"
import { inThisWindow, type Somewhere } from "./somewhere"

export type { Somewhere }

/**
 * What the window remembers from the last time it was open.
 *
 * The reason this exists is a measurement rather than a preference. GitHub's search
 * API takes between four and seven seconds to answer what belongs in a Working Set,
 * and no arrangement of requests gets under about four: their cheapest useful search
 * is 1.3 seconds on its own. So the wait cannot be shortened. It can only stop being
 * a wait — the reader is shown the list they were looking at a moment ago, and it is
 * replaced the instant GitHub answers.
 *
 * `useLive` already has the seam for it and the extension already fills it from
 * `browser.storage`. This is the same idea with the window's own storage underneath,
 * which is the whole of what a second platform costs here.
 *
 * Two things are deliberately not done. Nothing is remembered for longer than it is
 * useful — a stale row is replaced within seconds and never outlives the read — and
 * nothing is remembered that a reader would mind leaving on disk: titles, numbers
 * and check tallies of pull requests they can already see on github.com, in a file
 * only their account can read. The token is in the keychain and stays there.
 */

/**
 * The shape this file writes, which is not the shape it will always write.
 *
 * A version rather than a migration: what is kept here is a copy of something
 * GitHub will answer again in seconds, so anything written by an older build is
 * dropped rather than upgraded. Reading a `CardFacts` from two shapes ago into a
 * screen is how a first paint becomes a crash.
 */
const SHAPE = 1

/** How many cards are worth keeping, oldest evicted first. */
const CARDS = 12

const ROWS = KEPT_ROWS
const CARD = KEPT_CARD
const SEEN = KEPT_SEEN

type Kept<T> = { readonly shape: number; readonly at: string; readonly it: T }

const readFrom = <T>(where: Somewhere, key: string): T | null => {
  const held = where.getItem(key)
  if (held === null) return null

  try {
    const kept = JSON.parse(held) as Kept<T>
    // Written by an older build, or by something that was not this. Dropped, for
    // the reason in `SHAPE`.
    if (kept.shape !== SHAPE) return null
    return kept.it
  } catch {
    return null
  }
}

/**
 * A write that cannot fail loudly.
 *
 * Storage has a quota and this is the only thing in the window that could reach
 * it. What happens when it does is that the next launch draws the bones instead of
 * a list, which is exactly what happened before any of this existed — worth a
 * silent catch, where the alternative is a working read that throws on its way out
 * for the sake of a nicety.
 */
const writeTo = <T>(where: Somewhere, key: string, it: T): void => {
  try {
    where.setItem(key, JSON.stringify({ shape: SHAPE, at: new Date().toISOString(), it }))
  } catch {
    // Nothing. See above.
  }
}

const keyOf = (reference: PullRequestRef): string =>
  `${CARD}${reference.owner}/${reference.repo}#${reference.number}`

/** The Working Set as it was, or nothing at all if this is a first run. */
export const keptRows = (
  where: Somewhere | null = inThisWindow()
): ReadonlyArray<WorkingSetRow> | null => (where === null ? null : readFrom(where, ROWS))

export const keepRows = (
  rows: ReadonlyArray<WorkingSetRow>,
  where: Somewhere | null = inThisWindow()
): void => {
  if (where !== null) writeTo(where, ROWS, rows)
}

/** One pull request's card as it was, for the window it is opened in next. */
export const keptCard = (
  reference: PullRequestRef,
  where: Somewhere | null = inThisWindow()
): CardFacts | null => (where === null ? null : readFrom(where, keyOf(reference)))

/**
 * Keep a card, without the file content.
 *
 * A snapshot arrives with the first ten patches embedded and those are most of its
 * weight — a single large diff is bigger than every row in the Working Set put
 * together, and twelve of them would be the whole quota spent on the one thing that
 * is cheap to ask for again. So the files are kept and their content is not: the
 * remembered card draws its header, its checks, its conversation and its file tree
 * at once, and the diff arrives when GitHub answers.
 */
export const keepCard = (
  reference: PullRequestRef,
  facts: CardFacts,
  where: Somewhere | null = inThisWindow()
): void => {
  if (where === null) return

  const light: CardFacts = {
    ...facts,
    files: facts.files.map((file) => ({
      ...file,
      content: file.content === "here" ? ("unasked" as const) : file.content,
      patch: null
    }))
  }

  const key = keyOf(reference)
  writeTo(where, key, light)

  // The order they were last opened in, so the twelve that are kept are the twelve
  // a reader has been working in rather than the first twelve they ever opened.
  const seen = (readFrom<ReadonlyArray<string>>(where, SEEN) ?? []).filter((one) => one !== key)
  const now = [key, ...seen]

  for (const gone of now.slice(CARDS)) where.removeItem(gone)
  writeTo(where, SEEN, now.slice(0, CARDS))
}
