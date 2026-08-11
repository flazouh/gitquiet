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
    expect(barSheet()).toContain("html:has(#gitquiet-bar) header.GlobalNav")
    expect(barSheet()).not.toContain("data-gitquiet-gating")
  })

  test("name every page an interface stands on", () => {
    // A place missing from the list is a page whose gate is never written, which is
    // GitHub's own version of it on the screen for as long as the takeover takes.
    const sheet = readFileSync("src/ui/gates.load.css", "utf8")
    for (const place of PLACES) expect(sheet).toContain(`data-gitquiet-page="${place.name}"`)
  })
})
