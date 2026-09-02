import type { Changed } from "../domain/compare"

/**
 * Every file a comparison changes, out of the fragment their own page defers to.
 *
 * Scraping, for the reason `actionsList.ts` gives about their Actions list: the
 * fragment is server-rendered and one fetch carries every path, both counts and the
 * kind of change already on it. There is no JSON route beside it.
 *
 * Written to come back empty rather than wrong. A row whose path cannot be read is
 * skipped, so a fragment that has stopped looking like this yields nothing and the
 * screen hands the document back to GitHub.
 */

/** "+82" and "−7", which are their words with their own minus sign. */
const howMany = (said: string | null | undefined): number => {
  // Their minus is U+2212, not a hyphen. A parser that only knew the hyphen read
  // every deletion as zero, which is a diff that looks like it only ever added.
  const found = /(\d[\d,]*)/.exec(said ?? "")
  return found === null ? 0 : Number(found[1]?.replaceAll(",", "") ?? 0)
}

/**
 * What happened to a file, off the title their own icon carries.
 *
 * That title is a word for a screen reader — "modified", "added", "removed",
 * "renamed" — which makes it the one thing on the row that says the kind out loud.
 * Anything else here is reading a colour.
 */
const kindOf = (row: Element): Changed["kind"] => {
  const said = row.querySelector("svg[title]")?.getAttribute("title")?.toLowerCase() ?? ""
  if (said.includes("add")) return "added"
  if (said.includes("remov") || said.includes("delet")) return "removed"
  if (said.includes("renam")) return "renamed"
  return "modified"
}

const changedFrom = (row: Element): Changed | null => {
  // The row's own name link, which is the one anchor that is not the diffstat's.
  const named = [...row.querySelectorAll<HTMLAnchorElement>('a[href^="#diff-"]')].find(
    (link) => (link.textContent ?? "").trim().length > 0
  )
  const path = named?.textContent?.trim()
  if (path === undefined || path === "") return null

  return {
    path,
    anchor: named?.getAttribute("href") ?? null,
    added: howMany(row.querySelector(".color-fg-success")?.textContent),
    deleted: howMany(row.querySelector(".color-fg-danger")?.textContent),
    kind: kindOf(row)
  }
}

/**
 * Every changed file the fragment lists.
 *
 * Read off their table of contents rather than off the diff blocks below it. The
 * fragment holds both, and only the contents is complete: their diff renders a handful
 * of files and defers the rest, so a reader counting `.js-file` blocks on a
 * forty-one-file comparison finds four.
 */
export const changedInCompare = (page: Document): ReadonlyArray<Changed> =>
  [...page.querySelectorAll("#toc li")]
    .map(changedFrom)
    .filter((one): one is Changed => one !== null)
