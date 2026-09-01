import type { GistRow } from "../domain/gistList"

/**
 * One row's own gist address — `/{owner}/{id}` — read off the link every row
 * carries beside its filename, and not off the "N file(s)" link, the forks
 * link, or the stargazers link, which all sit in the same row and share the
 * same class.
 */
const addressOf = (row: Element): { readonly owner: string; readonly id: string } | null => {
  const link = row.querySelector<HTMLAnchorElement>('a[href^="/"] > strong.css-truncate-target')
    ?.closest("a")
  const href = link?.getAttribute("href") ?? null
  if (href === null) return null

  const segments = href.split("/").filter((part) => part.length > 0)
  const [owner, id] = segments
  return owner === undefined || id === undefined ? null : { owner, id }
}

/**
 * One row of a reader's own gist list, out of the markup GitHub already sent
 * — see `docs/spec/gists.md`. No request beyond the one that loaded the page:
 * the description, the visibility and every file's content preview are all
 * already in this document.
 */
const rowFrom = (row: Element): GistRow | null => {
  const address = addressOf(row)
  if (address === null) return null

  const title = row.querySelector("strong.css-truncate-target")?.textContent?.trim() ?? address.id
  const secret = [...row.querySelectorAll(".Label")].some(
    (label) => label.textContent?.trim() === "Secret"
  )
  const description =
    row.querySelector(".gist-snippet-meta span.f6.color-fg-muted")?.textContent?.trim() ?? null
  const updatedAt = row.querySelector("relative-time")?.getAttribute("datetime") ?? ""

  // Every file's own preview, markdown or code alike — `.Box-body`'s own text
  // rather than a narrower selector for one file kind, because a code block's
  // markup and a rendered README's are nothing alike and the reader searching
  // does not care which either file is.
  const preview = [...row.querySelectorAll(".js-gist-file-update-container .Box-body")]
    .map((body) => body.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  return { id: address.id, owner: address.owner, title, description, preview, secret, updatedAt }
}

/** One row's own element, paired with what was read out of it. */
export type PlacedRow = { readonly element: Element; readonly row: GistRow }

/**
 * Every row on a reader's own gist list page, each still holding the element
 * it was read from.
 *
 * The pairing lives here rather than being re-derived by a caller, because a
 * row `rowFrom` could not parse is dropped — so the elements and the rows are
 * not the same length, and matching them back up by re-reading an address out
 * of the element a second time is the kind of thing that drifts the moment
 * either side changes. One pass, kept together from the start.
 */
export const placedRowsOnPage = (page: Document): ReadonlyArray<PlacedRow> =>
  [...page.querySelectorAll(".gist-snippet")]
    .map((element) => ({ element, row: rowFrom(element) }))
    .filter((placed): placed is PlacedRow => placed.row !== null)

/** Every row on a reader's own gist list page. */
export const rowsOnPage = (page: Document): ReadonlyArray<GistRow> =>
  placedRowsOnPage(page).map(({ row }) => row)
