import { describe, expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { PROBED_PAGES, STALE_DAYS } from "./probedPages"

/**
 * The ledger has to cover every probe and be readable; how old a row is, it only says.
 *
 * A failing clock is a bad test — it breaks a build on a date rather than on a change — so
 * age is a warning here, not an assertion. The live canary is what turns an old row into a
 * red run against real GitHub. This keeps the ledger complete and well-formed, which is
 * deterministic, and prints the ages so a stale page is loud in the output.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/

const probesOnDisk = readdirSync("scripts")
  .filter((name) => /^probe-.*-dom\.js$/.test(name))
  .map((name) => `scripts/${name}`)

const probesInLedger = PROBED_PAGES.map((page) => page.probe).filter(
  (probe): probe is string => probe !== undefined
)

describe("the probed-page ledger is complete and well-formed", () => {
  test("every DOM probe on disk has exactly one row", () => {
    expect([...probesInLedger].sort()).toEqual([...probesOnDisk].sort())
  })

  test("no row names a probe that is not there", () => {
    const missing = probesInLedger.filter((probe) => !probesOnDisk.includes(probe))
    expect(missing).toEqual([])
  })

  test("a row with no probe is a canary-only target: it names a place and a url", () => {
    for (const page of PROBED_PAGES)
      if (page.probe === undefined) {
        expect(page.place).toBeDefined()
        expect(page.url).toBeDefined()
      }
  })

  test("every capture date is a real YYYY-MM-DD", () => {
    for (const page of PROBED_PAGES) {
      expect(page.capturedOn).toMatch(DATE)
      expect(Number.isNaN(Date.parse(page.capturedOn))).toBe(false)
    }
  })

  test("a row with a canary URL names the place whose selectors it checks", () => {
    for (const page of PROBED_PAGES)
      if (page.url !== undefined && page.place === undefined)
        // A URL with no place is a canary target with nothing to assert against.
        expect(`${page.probe} has a url but no place`).toBe("every url has a place")
  })
})

describe("how old the guarantees are", () => {
  test("warns for any page not read from live in a while", () => {
    const now = Date.now()
    const old = PROBED_PAGES.map((page) => ({
      page: page.page,
      probe: page.probe,
      days: Math.floor((now - Date.parse(page.capturedOn)) / 86_400_000)
    })).filter((one) => one.days > STALE_DAYS)

    for (const one of old)
      // Not a failure: a nudge to run the probe and refresh the fixture and the date.
      console.warn(`stale ${one.days}d: ${one.page} — reprobe with ${one.probe}`)

    expect(true).toBe(true)
  })
})
