import { describe, expect, test } from "bun:test"
import { barSheet, loadSheet, softSheet } from "./gateCss"
import type { Place } from "./place"

/**
 * What is left of the gates, which is one rule.
 *
 * There used to be a sheet per place and a rule per region of GitHub's, written
 * from a table of their selectors and tested here selector by selector. The
 * interface stands in a shadow root of its own now, so there is nothing of theirs
 * to name: everything in `body` that is not the host goes, and the host is the
 * only thing that has to be got right.
 */
const page: Place = {
  name: "example",
  owns: (path) => path === "/example",
  soft: true
}

describe("the rule that keeps GitHub's page off the screen", () => {
  test("hides everything in body that is not our host", () => {
    expect(loadSheet([page])).toContain(
      "body > *:not(#gitquiet-host):not([data-gitquiet-outside])"
    )
    expect(loadSheet([page])).toContain("display: none")
  })

  test("applies while any page of ours is marked, and only then", () => {
    // The mark goes on when a place is claimed and comes off when the page is
    // handed back, so one condition covers both the wait before ours is drawn and
    // the whole time it is up. Unkeyed, this would empty a page we never took.
    expect(loadSheet([page])).toContain("html[data-gitquiet-page]")
  })

  test("names nothing of GitHub's", () => {
    // The point of the whole migration. A rule that mentions one of their class
    // names is a rule that rots on their next deploy, silently.
    const sheet = loadSheet([page])
    expect(sheet).not.toContain("PageLayoutContent")
    expect(sheet).not.toContain("PullRequestHeader")
    expect(sheet).not.toContain("react-app")
    expect(sheet).not.toContain("aria-label")
  })

  test("is one rule, whatever the table says", () => {
    // It used to grow with every place and every region in it. It does not grow.
    const one = loadSheet([page])
    const many = loadSheet([page, { ...page, name: "other" }, { ...page, name: "third" }])
    expect(many).toBe(one)
  })

  test("spares our own furniture, wherever it has to stand", () => {
    // The bar and the overlay hosts are inside the host now, but anything of ours
    // that has to sit in their document carries the outside mark, and the rule
    // reads that mark rather than a list of ids.
    expect(loadSheet([page])).toContain(":not([data-gitquiet-outside])")
  })
})

describe("the sheets that no longer have anything to say", () => {
  test("a soft navigation needs no gate of its own", () => {
    // It used to hide their regions on the press, before their page had rendered,
    // because ours was about to stand in one of them. Ours stands on its own stage
    // either way, and the load rule is already on.
    expect(softSheet([page])).not.toContain("display: none")
  })

  test("their bar is the only thing left the bar sheet hides", () => {
    expect(barSheet()).toContain("header.GlobalNav")
  })
})
