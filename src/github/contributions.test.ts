import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { contributionsIn, contributionsRoute } from "./contributions"

/**
 * The heading as GitHub sends it, copied out of a live read of
 * `/users/seawatts/contributions` rather than written to suit the parser.
 *
 * Its whitespace is the point: the number, the word and the period are on three
 * separate lines, so anything that expects them adjacent fails here.
 */
const heading = (said: string) => `<div class="js-yearly-contributions">
  <div class="position-relative">
    <h2 tabindex="-1" id="js-contribution-activity-description" class="f4 text-normal mb-2">
      ${said}
    </h2>
    <a href="#year-link-2026" class="show-on-focus">Skip to contributions year list</a>
    <table class="ContributionCalendar-grid"><tbody><tr><td data-level="4"></td></tr></tbody></table>
  </div>
</div>`

describe("a year of somebody's work", () => {
  test("reads the total out of the heading above the calendar", () => {
    const found = contributionsIn(heading("3,212\n      contributions\n        in the last year"))

    expect(found).toEqual(Option.some(3212))
  })

  test("reads a count that needs no separator", () => {
    expect(contributionsIn(heading("847\n      contributions\n        in the last year"))).toEqual(
      Option.some(847)
    )
  })

  test("reads one contribution, which GitHub says in the singular", () => {
    expect(contributionsIn(heading("1\n      contribution\n        in the last year"))).toEqual(
      Option.some(1)
    )
  })

  test("takes a year in the heading as the period, never as part of the count", () => {
    // Their heading for a chosen year reads "1,204 contributions in 2024". A parser
    // that stripped everything but digits would report twelve hundred and four
    // followed by the year.
    expect(contributionsIn(heading("1,204\n      contributions\n        in 2024"))).toEqual(
      Option.some(1204)
    )
  })

  test("counts a new account's nothing as none rather than as unreadable", () => {
    expect(contributionsIn(heading("No contributions\n        in the last year"))).toEqual(
      Option.some(0)
    )
  })

  test("yields nothing where the page no longer says it", () => {
    // Nothing, so the card leaves the line out. Zero here would report somebody
    // who has done nothing all year on the strength of a GitHub redesign.
    expect(contributionsIn("<div>a page that has changed shape entirely</div>")).toEqual(
      Option.none()
    )
  })

  test("yields nothing for a heading that has stopped being a count", () => {
    expect(contributionsIn(heading("Activity overview"))).toEqual(Option.none())
  })
})

describe("where the calendar lives", () => {
  test("is that person's own", () => {
    expect(contributionsRoute("seawatts")).toBe("/users/seawatts/contributions")
  })

  test("escapes a login rather than trusting it into a path", () => {
    expect(contributionsRoute("a login/../elsewhere")).toBe(
      "/users/a%20login%2F..%2Felsewhere/contributions"
    )
  })
})
