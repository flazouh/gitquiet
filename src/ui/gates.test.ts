import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { barSheet, loadSheet, PREAMBLE, softSheet } from "./gateCss"
import { PLACES } from "./place"

/**
 * The committed sheets say what the table says.
 *
 * They have to be committed — a content script's stylesheet is applied before the
 * document is displayed only if the manifest declares it, so it cannot be built
 * while the page loads — and a generated file that is committed is a file that can
 * be left behind. This is the thing that notices. Run
 * `bun scripts/build-gates.ts`.
 */
describe("the generated gate stylesheets", () => {
  test("say what place.ts says about hiding a loaded page", () => {
    expect(readFileSync("src/ui/gates.load.css", "utf8")).toBe(`${PREAMBLE}\n${loadSheet(PLACES)}`)
  })

  test("say what place.ts says about hiding a page swapped in", () => {
    expect(readFileSync("src/ui/gates.soft.css", "utf8")).toBe(`${PREAMBLE}\n${softSheet(PLACES)}`)
  })

  test("say what hides their own bar", () => {
    expect(readFileSync("src/ui/gates.bar.css", "utf8")).toBe(`${PREAMBLE}\n${barSheet()}`)
  })

  test("hide their bar on the presence of ours, never on the takeover starting", () => {
    // Keyed the other way round, a press would take their bar off the screen before ours
    // arrived, and the page would have no bar at all for as long as that took.
    expect(barSheet()).toContain("html[data-gitquiet-bar-standing] header.GlobalNav")
    expect(barSheet()).not.toContain("data-gitquiet-gating")
  })

  test("hide their page on any page of ours, without naming one of them", () => {
    /*
     * It used to be a rule per place, and this asserted that none had been left
     * out — a place missing from the list was a page whose gate was never written.
     * There is one rule now and it is keyed on the mark being there at all, so
     * there is no list to fall off: a place added tomorrow is gated by the same
     * line, and the sheet names no page and no markup of GitHub's.
     *
     * Two states of the mark, not one: a page still arriving, and a page a screen
     * of ours has taken. A page handed back keeps its name and is shown — keyed on
     * the name alone, every hand-back left the reader in front of a black page.
     */
    const sheet = readFileSync("src/ui/gates.load.css", "utf8")
    expect(sheet).toContain("html[data-gitquiet-page]:not([data-gitquiet-revealed]) body >")
    expect(sheet).toContain("html[data-gitquiet-page][data-gitquiet-taken] body >")
    for (const place of PLACES) expect(sheet).not.toContain(`data-gitquiet-page="${place.name}"`)
  })
})
