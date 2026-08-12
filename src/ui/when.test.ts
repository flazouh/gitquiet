import { describe, expect, test } from "bun:test"
import { ageOf, freshnessOf, momentOf } from "./when"

const now = new Date("2026-07-27T12:00:00Z")
const ago = (iso: string) => ageOf(iso, now)

describe("how long ago", () => {
  test("calls the last minute just now", () => {
    expect(ago("2026-07-27T11:59:30Z")).toBe("just now")
  })

  test("counts minutes, then hours, then days", () => {
    expect(ago("2026-07-27T11:20:00Z")).toBe("40m ago")
    expect(ago("2026-07-27T04:00:00Z")).toBe("8h ago")
    expect(ago("2026-07-25T12:00:00Z")).toBe("2d ago")
  })

  test("stops saying ago once it is a month old and prints the date", () => {
    expect(ago("2026-05-04T12:00:00Z")).toBe("4 May")
  })

  test("says nothing at all rather than NaN when the date is unreadable", () => {
    expect(ago("not a date")).toBe("")
  })
})

describe("how recently, as a colour", () => {
  test("paints the last day green, the last week amber, this month muted, and older quieter", () => {
    expect(freshnessOf("2026-07-27T04:00:00Z", now)).toBe("text-pass")
    expect(freshnessOf("2026-07-24T12:00:00Z", now)).toBe("text-busy")
    expect(freshnessOf("2026-07-10T12:00:00Z", now)).toBe("text-ink-muted")
    expect(freshnessOf("2026-05-04T12:00:00Z", now)).toBe("text-ink-muted/50")
  })
})

describe("the exact moment", () => {
  test("spells out the timestamp for a hover", () => {
    expect(momentOf("2026-07-25T10:21:12Z")).toContain("25 Jul 2026")
  })

  test("hands back what it was given when it cannot read it", () => {
    expect(momentOf("nonsense")).toBe("nonsense")
  })
})
