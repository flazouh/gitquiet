import { matchesQuery } from "../domain/gistList"
import { placedRowsOnPage } from "../github/gistList"

/**
 * The search bar over a reader's own gist list.
 *
 * Plain DOM, planted once, the same way `gistBanner.ts` is: there is no
 * region to take over here, only a control to add above rows GitHub already
 * drew. Filtering hides a row with `display: none` rather than redrawing the
 * list, because the content each row is matched against is already on the
 * page and there is nothing to redraw.
 */
export const GHOST_ID = "gitquiet-gist-search"

/** What else a row answers to, beyond what GitHub sent — a Label, a Name. Nothing by default. */
export type ExtraTextFor = (id: string) => string

const NOTHING_EXTRA: ExtraTextFor = () => ""

const applyFilter = (page: Document, query: string, extraTextFor: ExtraTextFor): void => {
  // A row `placedRowsOnPage` could not parse is left off this list entirely,
  // and so left visible — a row a search cannot be matched against is not
  // one it should hide.
  for (const { element, row } of placedRowsOnPage(page)) {
    const matches = matchesQuery(row, query, extraTextFor(row.id))
    ;(element as HTMLElement).style.display = matches ? "" : "none"
  }
}

/**
 * Puts the search bar on the page, once, where there is a list to search.
 *
 * Idempotent for the reason `plantSecretBanner` is: GitHub can redraw the
 * list without loading a document, and a second call after that must not
 * plant a second bar above the first.
 *
 * `extraTextFor` is asked again on every keystroke rather than captured once,
 * so a Label added after this was planted is already searchable without
 * planting the bar a second time.
 */
export const plantGistSearch = (page: Document, extraTextFor: ExtraTextFor = NOTHING_EXTRA): void => {
  const list = page.querySelector(".gist-snippet")?.parentElement
  if (list === null || list === undefined) return
  if (page.getElementById(GHOST_ID) !== null) return

  const input = page.createElement("input")
  input.id = GHOST_ID
  input.type = "search"
  input.placeholder = "Search your gists — titles, descriptions, and file content GitHub's own search does not read"
  input.className = "form-control width-full mb-3"
  input.addEventListener("input", () => applyFilter(page, input.value, extraTextFor))

  list.prepend(input)
}

/**
 * Runs the search already typed again, against whatever `extraTextFor` says
 * now — for a caller whose own change (a Label saved, a Name set) should
 * narrow or widen the same query rather than waiting for the next keystroke.
 *
 * Nothing where the bar was never planted, or nothing has been typed: an
 * empty query already matches everything, so there is nothing to redo.
 */
export const reapplyGistSearch = (page: Document, extraTextFor: ExtraTextFor = NOTHING_EXTRA): void => {
  const input = page.getElementById(GHOST_ID) as HTMLInputElement | null
  if (input === null || input.value.length === 0) return

  applyFilter(page, input.value, extraTextFor)
}
