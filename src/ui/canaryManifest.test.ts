import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { manifestFor, manifestJson } from "./canaryManifest"
import { PLACES } from "./place"
import { PROBED_PAGES } from "./probedPages"

/**
 * The committed manifest says what the tables say.
 *
 * The canary reads this file rather than `place.ts`, so a manifest left behind is the
 * canary checking selectors the extension no longer uses — green while the real hooks
 * drift. This is what notices. Run `bun scripts/build-canary-manifest.ts`.
 */
describe("the canary manifest", () => {
  test("matches place.ts and the probed-page ledger", () => {
    expect(readFileSync("src/ui/canary.manifest.json", "utf8")).toBe(
      manifestJson(PLACES, PROBED_PAGES)
    )
  })

  test("carries a target for every ledger row that names a place and a url", () => {
    const expected = PROBED_PAGES.filter((row) => row.url !== undefined && row.place !== undefined)
    expect(manifestFor(PLACES, PROBED_PAGES).targets).toHaveLength(expected.length)
  })

  test("gives every target a region to stand in", () => {
    for (const target of manifestFor(PLACES, PROBED_PAGES).targets)
      expect(target.regions.length).toBeGreaterThan(0)
  })
})
