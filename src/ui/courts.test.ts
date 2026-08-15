import { describe, expect, test } from "bun:test"
import { COURT_ART, courtArt } from "./courts"

describe("the glyph a Court heading wears", () => {
  test("turns while a job is turning, which is what the glyph was drawn for", () => {
    expect(courtArt("running", true)).toBe("check-running")
  })

  /*
   * Found on `octo-org/octo-repo#1787`: fourteen checks passed, and Running
   * held two findings the reader had already answered. The heading turned anyway,
   * saying a machine was working, while no job existed to come back.
   */
  test("rests where a Court is a machine's and nothing is running", () => {
    expect(courtArt("running", false)).toBe("check-queued")
  })

  test("leaves the other three alone, none of them claiming movement", () => {
    for (const court of ["needs-you", "waiting", "settled"] as const) {
      expect(courtArt(court, false)).toBe(COURT_ART[court])
      expect(courtArt(court, true)).toBe(COURT_ART[court])
    }
  })
})
