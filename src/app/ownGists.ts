import { Effect } from "effect"
import type { GistRow } from "../domain/gistList"
import { olderPageIn, rowsOnPage } from "../github/gistList"

/**
 * Every gist a reader owns, across every page of their list.
 *
 * GitHub pages this list, and the oldest complaint in the whole gist survey is what
 * that costs: "It's always been a huge pain to search for something you know you
 * gisted, but can no longer find without browsing through 20 pages of 3-line excerpts"
 * — Hacker News, 2012, still true. A search that reads the page in front of the reader
 * answers exactly as badly as GitHub's own does.
 *
 * So the list is read whole, once, and every filter after it — search, Label, Type,
 * Sort — runs over all of it. See `research/gist-pain-points.md` in the notes
 * repository, and `plans/007-give-the-gists-a-screen.md`.
 */

/**
 * How many pages deep this will go before it stops.
 *
 * A bound rather than a belief. Their pager is the only thing that says whether another
 * page exists, and a pager that started answering "Older" forever — a redesign, a bug,
 * a loop — would otherwise be an infinite walk against their server. Thirty pages is
 * three thousand gists at their hundred-a-page, which is far past anybody's list: the
 * largest number named anywhere in the research is the reader with five hundred.
 */
const HOW_DEEP = 30

/** How a page of their list is fetched, so a test can answer without a network. */
export type ReadPage = (address: string) => Effect.Effect<Document, unknown>

/**
 * Where the walk starts, which is the page the reader is already looking at.
 *
 * Handed in rather than fetched, because the content script already has it: the
 * document it is running in *is* page one, and asking their server for a copy of the
 * page in front of the reader is a request that buys nothing.
 */
export type OwnGists = {
  readonly rows: ReadonlyArray<GistRow>
  /**
   * Whether every page was read, or the walk stopped at {@link HOW_DEEP}.
   *
   * Said rather than hidden, because a list that is quietly missing its oldest gists is
   * a search that quietly answers "no such gist" about one the reader is sure they
   * wrote. The screen tells them instead.
   */
  readonly whole: boolean
}

export const readOwnGists = (
  first: Document,
  readPage: ReadPage
): Effect.Effect<OwnGists> =>
  Effect.gen(function* () {
    const rows: Array<GistRow> = [...rowsOnPage(first)]
    let next = olderPageIn(first)

    for (let depth = 1; next !== null && depth < HOW_DEEP; depth++) {
      /*
       * A page that fails stops the walk and keeps what came before it.
       *
       * The reader is looking at their gists either way, and half a list they can
       * search beats a failure over a list GitHub already drew for them. `whole` below
       * is what says the difference out loud.
       */
      const page = yield* readPage(next).pipe(Effect.option)
      if (page._tag === "None") return { rows, whole: false }

      rows.push(...rowsOnPage(page.value))
      next = olderPageIn(page.value)
    }

    return { rows, whole: next === null }
  })
