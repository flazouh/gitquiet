import { describe, expect, test } from "bun:test"
import { loadSheet, softSheet } from "./gateCss"
import type { Place } from "./place"

const page: Place = {
  name: "example",
  owns: (path) => path === "/example",
  regions: ["#theirs"],
  fallback: "#wider",
  stages: ["#theirs", "#wider"],
  bands: ["#their-header"],
  soft: { within: "app-of-theirs", holding: ":has(.their-row)" }
}

/** How every rule in the loading sheet begins, and why one sheet is safe anywhere. */
const HERE = 'html[data-gitquiet-page="example"]'

describe("the rules that keep GitHub's page off the screen", () => {
  test("hides what their region holds until ours is on the page", () => {
    expect(loadSheet([page])).toContain(
      `${HERE}:not([data-gitquiet-revealed]) #theirs > *:not(#gitquiet-root):not([data-gitquiet-within])`
    )
  })

  test("goes on hiding it for as long as ours is in charge", () => {
    // Not the same fact twice. Their React re-renders the region for the life of
    // the page, and every insertion has to arrive under a rule that already
    // decided about it rather than wait for an observer to notice.
    expect(loadSheet([page])).toContain(
      "html[data-gitquiet-taken] #theirs > *:not(#gitquiet-root):not([data-gitquiet-within])"
    )
  })

  test("says which page each by-default rule is for", () => {
    // One sheet is on every page of GitHub now, and these hooks are shared: an
    // issue, a discussion and a release all have a `PageLayoutContent`. Unkeyed, a
    // rule that hides by default hides three pages we have no business with.
    for (const rule of loadSheet([page]).split("\n")) {
      if (!rule.includes("data-gitquiet-revealed")) continue
      expect(rule).toContain('[data-gitquiet-page="example"]')
    }
  })

  test("does not name the page in the rules that hold the takeover", () => {
    /*
     * The one moment they carry the page on their own: a reader leaving a pull
     * request for a list. The name changes to the destination the instant the press
     * lands, while the card is still standing on the screen for the few hundred
     * milliseconds the list takes — and a rule keyed on the name would let their
     * conversation back up underneath it.
     */
    for (const rule of loadSheet([page]).split("\n")) {
      if (!rule.includes("data-gitquiet-taken")) continue
      expect(rule).not.toContain("data-gitquiet-page")
    }
  })

  test("never hides the box our own interface is standing in", () => {
    // The whole rule set is a hair away from hiding the interface it exists to
    // show: our root is a child of one of these regions, and on a soft navigation
    // it is a grandchild of another. The mark on the way down is what answers the
    // grandchild, and the takeover writes it in the same breath as the append.
    for (const rule of loadSheet([page]).split("\n")) {
      if (!rule.includes("> *")) continue
      expect(rule).toContain(":not(#gitquiet-root):not([data-gitquiet-within])")
    }
  })

  test("hides the bands ours replaces, region or no region", () => {
    expect(loadSheet([page])).toContain(`${HERE}:not([data-gitquiet-revealed]) #their-header`)
    expect(loadSheet([page])).toContain("html[data-gitquiet-taken] #their-header")
  })

  test("takes every place ours may stand in, not only the best one", () => {
    // A region that moves is what lapsed the repository list's rules in July: the
    // list is in one element most of the time and in its Turbo frame the rest.
    expect(loadSheet([page])).toContain("#wider > *")
  })
})

describe("the rules for a page GitHub swapped in without loading it", () => {
  test("waits for their own markup before hiding anything", () => {
    // This sheet is on every page of GitHub, and the attribute keying it is set on
    // the press — while the page being left is still the page on the screen. Wait
    // for proof that their version of the destination is really rendered, or it is
    // the reader's current page that goes blank.
    expect(softSheet([page])).toContain(
      "html[data-gitquiet-gating] app-of-theirs #theirs:has(.their-row) > *"
    )
  })

  test("says nothing about a page that is never swapped in", () => {
    const loaded: Place = { ...page, soft: undefined }
    expect(softSheet([loaded])).not.toContain("#theirs")
  })

  test("does not ask for their app inside their own app", () => {
    // Two of these selectors carry the app element themselves, because a Primer
    // class name alone would match the wrong page. Prefixed with it a second time
    // the rule matches nothing at all, which reads exactly like no rule.
    const scoped: Place = {
      ...page,
      stages: ['app-of-theirs [class*="Content"]'],
      soft: { within: "app-of-theirs" }
    }
    expect(softSheet([scoped])).toContain('app-of-theirs [class*="Content"] > *')
    expect(softSheet([scoped])).not.toContain("app-of-theirs app-of-theirs")
  })

  test("leaves out a band that belongs to another of their pages", () => {
    const shared: Place = {
      ...page,
      bands: ['react-app[app-name="commits"] [class*="Header"]'],
      soft: { within: 'react-app[app-name="pull-requests"]' }
    }
    expect(softSheet([shared])).not.toContain("commits")
  })

  test("keeps the by-default hiding out of it", () => {
    // A rule that hid by default here would hide most of GitHub: this sheet ships
    // with the one script that runs on every page of the site.
    expect(softSheet([page])).not.toContain("data-gitquiet-revealed")
  })
})
