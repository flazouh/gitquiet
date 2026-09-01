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

const applyFilter = (page: Document, query: string): void => {
  // A row `placedRowsOnPage` could not parse is left off this list entirely,
  // and so left visible — a row a search cannot be matched against is not
  // one it should hide.
  for (const { element, row } of placedRowsOnPage(page)) {
    ;(element as HTMLElement).style.display = matchesQuery(row, query) ? "" : "none"
  }
}

/**
 * Puts the search bar on the page, once, where there is a list to search.
 *
 * Idempotent for the reason `plantSecretBanner` is: GitHub can redraw the
 * list without loading a document, and a second call after that must not
 * plant a second bar above the first.
 */
export const plantGistSearch = (page: Document): void => {
  const list = page.querySelector(".gist-snippet")?.parentElement
  if (list === null || list === undefined) return
  if (page.getElementById(GHOST_ID) !== null) return

  const input = page.createElement("input")
  input.id = GHOST_ID
  input.type = "search"
  input.placeholder = "Search your gists — titles, descriptions, and file content GitHub's own search does not read"
  input.className = "form-control width-full mb-3"
  input.addEventListener("input", () => applyFilter(page, input.value))

  list.prepend(input)
}
