/**
 * A repository's tabs, read out of the document GitHub serves for it.
 *
 * The bar draws Code, Issues and Pull requests itself and puts the rest behind the
 * repository's name, and which tabs those are is not something an address can say:
 * Issues, Discussions, Actions and Projects can each be switched off, Insights lives at
 * `/network/dependencies`, and the counts beside two of them are GitHub's own.
 *
 * This is the same row `theirNav.ts` reads off the live page, taken from a document
 * instead. That difference is the point. Their row is inside the header their React
 * hydrates, so on the page it is often absent exactly when the bar first draws — and a bar
 * with no row to read falls back to the two tabs an address can promise, which is a
 * repository page with no way to its issues on it. Read from a document, kept, and warmed
 * before the press, the row is on the screen from the first frame.
 */

import { UndefinedOr } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import type { Tab } from "../domain/tabs"

/** The count, and the visually hidden copy GitHub draws beside it for a screen reader. */
const COUNTS = '[class*="CounterLabel"], [class*="VisuallyHidden"]'

const nameOf = (link: Element): string => {
  /*
   * Read off a copy with the counts taken out, because their own text is "Issues195 (195)":
   * the number and its screen-reader duplicate are inside the anchor, and a name carrying
   * either of them would put "Issues195 (195)" in our bar.
   */
  const without = link.cloneNode(true) as Element
  for (const count of without.querySelectorAll(COUNTS)) count.remove()
  return (without.textContent ?? "").replace(/\s+/g, " ").trim()
}

const countIn = (link: Element): number | undefined => {
  const said = link.querySelector('[class*="CounterLabel"]')?.textContent?.trim()
  if (said === undefined || said === "") return undefined

  const many = Number.parseInt(said.replace(/,/g, ""), 10)
  return Number.isNaN(many) ? undefined : many
}

/**
 * The tabs in one of their rows, wherever the row was found.
 *
 * The one parser, used by the live page and by a fetched document. Two of these drifting
 * apart would show a reader one row before their header hydrates and a different one after.
 */
export const tabsInRow = (row: Element): ReadonlyArray<Tab> =>
  [...row.querySelectorAll("a")].flatMap((link) => {
    const href = link.getAttribute("href")
    const name = nameOf(link)
    if (href === null || name === "") return []

    return [{ name, href, count: countIn(link), here: link.getAttribute("aria-current") === "page" }]
  })

/** Their row in a document of theirs, or nothing where the document carries no such row. */
export const tabsOnPage = (html: string): ReadonlyArray<Tab> => {
  const page = new DOMParser().parseFromString(html, "text/html")
  const row = page.querySelector('nav[aria-label="Repository"]')

  return row === null ? [] : tabsInRow(row)
}

/**
 * Where a repository's row is kept between visits, one name per repository.
 *
 * `localStorage` rather than the store every other read is kept in, because of who reads
 * this and when: the bar wants the row in the same tick it first renders, and the other
 * store answers a promise later. A row arriving after the first paint is the flicker this
 * whole change exists to remove.
 *
 * Keyed by owner and repository, which is the part that makes keeping it safe at all. A
 * single kept row was rejected before for a good reason — it would draw `bun`'s tabs above
 * `hello-world` for as long as the page took to hydrate — and a row that can only ever be found
 * under the name it was read from cannot do that.
 */
const named = (repo: RepoRef): string => `gitquiet:tabs:${repo.owner}/${repo.repo}`

/**
 * Storage that cannot throw, as `keptRepositories.ts` next door has it.
 *
 * A private window, a profile with storage switched off and a spent quota all reach here,
 * and all three mean one thing to the bar: no row kept, so their own row is waited for as
 * it was before. None of them is a reason to fail to draw a bar.
 */
const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage, key: string) => store.getItem(key))
const write = UndefinedOr.liftThrowable((store: Storage, key: string, value: string) => {
  store.setItem(key, value)
})
const parse = UndefinedOr.liftThrowable((said: string): unknown => JSON.parse(said))

/** The row this repository had the last time one was read, or nothing where none was. */
export const keptTabs = (repo: RepoRef): ReadonlyArray<Tab> => {
  const store = held()
  if (store === undefined) return []

  const said = read(store, named(repo))
  if (said === undefined || said === null) return []

  const found = parse(said)
  return isKeptTabs(found) ? found : []
}

/** Keeps the row for the next bar built over this repository, which is the next press. */
export const keepTabs = (repo: RepoRef, tabs: ReadonlyArray<Tab>): void => {
  if (tabs.length === 0) return

  const store = held()
  if (store === undefined) return

  write(store, named(repo), JSON.stringify(tabs))
}

/**
 * Whether what came back out of the store is still a row of tabs.
 *
 * Checked rather than trusted because the store outlives the code: an entry written by a
 * version of this extension that has since been updated is exactly the shape that would
 * otherwise be handed to the bar and fail there.
 */
export const isKeptTabs = (value: unknown): value is ReadonlyArray<Tab> =>
  Array.isArray(value) &&
  value.every(
    (one: unknown) =>
      typeof one === "object" &&
      one !== null &&
      typeof (one as Tab).name === "string" &&
      typeof (one as Tab).href === "string" &&
      typeof (one as Tab).here === "boolean"
  )
