/**
 * Every repository a person has, which is more than the page they served.
 *
 * Two reads and they are not alike. The first is free: their repositories tab is
 * Rails-rendered, so the thirty rows of page one are in the document the screen is
 * standing in and cost nothing at all. The rest are requests, made behind the first
 * paint, and they are what makes the groups true — a Moving count over the first
 * thirty of 154 repositories is a wrong answer confidently drawn.
 *
 * Nothing is remembered between visits, unlike every other list in this codebase. The
 * reason those remember is that the reader waits on the read, and here the reader
 * waits on nothing: page one is already on the screen before this module is asked
 * anything.
 */

import { Effect } from "effect"
import type { Listing, ListedRepository } from "../domain/life"
import type { PersonPage } from "../domain/person"
import { hasNextIn, isTheirRepositories, repositoriesIn } from "../github/personRepos"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * How many pages one visit will read.
 *
 * Thirty rows a page, so this is 300 repositories, which covers all but a handful of
 * accounts. A cap rather than "until their pager stops" because the pager is theirs:
 * an account with four thousand repositories would otherwise have this fetching a
 * third of a megabyte at a time until the reader closed the tab.
 *
 * The screen says when it stopped here. A group counted over 300 of 4,000 is still a
 * wrong answer, and the honest thing is to say which of the two it is.
 */
export const AT_MOST = 10

/**
 * The rows of the page the screen is standing on.
 *
 * Nothing where the document is not one of theirs at all, which is how an organisation
 * — whose address looks exactly like a person's — reaches this and is refused. The
 * screen hands the page back on an empty listing.
 */
export const theirFirstPage = (page: Document): Listing =>
  isTheirRepositories(page)
    ? { rows: repositoriesIn(page), more: hasNextIn(page) }
    : { rows: [], more: false }

/**
 * Every page after the first, in order, until their pager runs out or the cap does.
 *
 * One at a time and never in parallel. A person with 154 repositories is five requests
 * for documents of a third of a megabyte each, and asking for all five at once is the
 * kind of thing GitHub is entitled to answer with a 429 — which would cost the reader
 * the whole list rather than the tail of it.
 *
 * Comes back with what it managed to read. A page that fails ends the walk rather than
 * failing the whole read: four pages of five is a list with a group count that is
 * nearly right, and nothing is a list with no groups at all.
 */
export const theirOtherPages = Effect.fn("theirOtherPages")(function* (
  page: PersonPage,
  upTo: number = AT_MOST
) {
  const gateway = yield* GitHubGateway
  const rows: Array<Listing["rows"][number]> = []

  for (let wanted = 2; wanted <= upTo; wanted += 1) {
    const listing = yield* gateway
      .personRepositories(page.login, wanted, page.narrowing)
      .pipe(Effect.orElseSucceed(() => ({ rows: [], more: false }) as Listing))

    rows.push(...listing.rows)
    if (!listing.more || listing.rows.length === 0) return { rows, more: false }
  }

  // The cap, and their pager still offering more. Said rather than hidden, because a
  // group counted over 300 rows of 4,000 is a number the screen must not present as
  // the whole.
  return { rows, more: true }
})

/** Their first page over the network, for the arrival where the document has none. */
const theirFirstPageAcross = Effect.fn("theirFirstPageAcross")(function* (page: PersonPage) {
  const gateway = yield* GitHubGateway
  return yield* gateway.personRepositories(page.login, 1, page.narrowing)
})

/** Their whole list, as far as one visit reads it. */
export type TheirList = {
  readonly rows: ReadonlyArray<ListedRepository>
  /** Whether the walk stopped at the cap rather than at the end of their list. */
  readonly capped: boolean
}

/**
 * Their list, reported as it arrives: page one first, then the rest behind it.
 *
 * Two halves because the reader's wait is not the same on each. Page one is in the
 * document and goes on the screen in the first frame, and the four requests behind it
 * are a second or two that nobody is watching — so the screen draws groups over thirty
 * rows immediately and redraws them over 154 when the walk ends.
 *
 * Page one is asked for over the network in one case: their frame is on the page but its
 * rows are not in it yet, which is what a soft press from the Overview tab looks like.
 * The frame is the proof that this is a person at all — an organisation has none, and the
 * screen never mounts there — so a fetch here cannot take over a page that is not theirs.
 */
export const theirWholeList = Effect.fn("theirWholeList")(function* (
  page: PersonPage,
  served: Document,
  sofar: (list: TheirList) => void,
  /**
   * How many pages the walk behind page one is worth here.
   *
   * The tab reads as far as the cap, because the whole list is what that page is. The
   * profile shows six rows and four counts off the same walk, and one page of theirs was
   * measured at 307 kilobytes — so a screen that wants a shape rather than a list says
   * how many pages that shape is worth and carries `capped` where the counts are.
   */
  upTo: number = AT_MOST
) {
  const inTheDocument = theirFirstPage(served)
  const first =
    inTheDocument.rows.length > 0 ? inTheDocument : yield* theirFirstPageAcross(page)

  sofar({ rows: first.rows, capped: false })
  if (!first.more) return { rows: first.rows, capped: false }

  const rest = yield* theirOtherPages(page, upTo)
  return { rows: [...first.rows, ...rest.rows], capped: rest.more }
})
