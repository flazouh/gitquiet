import { describe, expect, test } from "bun:test"
import { loadWhereNoDocumentWasServed } from "./softArrival"

/** A window as much as the rule reads: the address, the document's entry, and a way to load. */
const aWindow = (at: string, servedAt: string | null) => {
  const loaded: Array<string> = []
  const view = {
    location: {
      pathname: new URL(at).pathname,
      href: at,
      replace: (to: string) => void loaded.push(to)
    },
    performance: {
      getEntriesByType: (kind: string) =>
        kind === "navigation" && servedAt !== null ? [{ name: servedAt }] : []
    }
  }
  return { view, loaded }
}

/*
 * `#99` is written the same for an issue and a pull request, and our markdown links it to
 * `/issues/99`. GitHub's server redirects that address to `/pull/99` for a pull request,
 * but a soft navigation never asks it. Measured on flazouh/gitquiet#100: a press on #99
 * drew "This issue could not be read" with nothing of GitHub's behind it.
 */
describe("an issue read that failed", () => {
  const ROUTE = "/flazouh/gitquiet/issues/99"

  test("loads the address once where no document was served for it", () => {
    const { view, loaded } = aWindow(`https://github.com${ROUTE}`, "https://github.com/flazouh/gitquiet/issues/100")

    expect(loadWhereNoDocumentWasServed(view, ROUTE)).toBe(true)
    expect(loaded).toEqual([`https://github.com${ROUTE}`])
  })

  test("never loads a document that was served for this address, so it cannot loop", () => {
    const { view, loaded } = aWindow(`https://github.com${ROUTE}`, `https://github.com${ROUTE}`)

    expect(loadWhereNoDocumentWasServed(view, ROUTE)).toBe(false)
    expect(loaded).toEqual([])
  })

  test("leaves the page alone where the reader is somewhere else", () => {
    // An issue read ahead of a press fails while the reader is still on the list.
    const { view, loaded } = aWindow("https://github.com/flazouh/gitquiet/issues", "https://github.com/flazouh/gitquiet/issues")

    expect(loadWhereNoDocumentWasServed(view, ROUTE)).toBe(false)
    expect(loaded).toEqual([])
  })
})
