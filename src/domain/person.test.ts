import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { personPageIn, personReposIn, personStarsIn, profileIn, tabRoute } from "./person"

const read = (url: string) => personPageIn(url)
const readOrThrow = (url: string) => Option.getOrThrow(personPageIn(url))

describe("reading a person's page from its address", () => {
  test("takes the login out of the one segment there is", () => {
    const page = readOrThrow("https://github.com/flazouh")

    expect(page.login).toBe("flazouh")
    expect(page.tab).toBe("profile")
    expect(page.page).toBe(1)
  })

  test("reads their own word for the profile as the profile", () => {
    // What GitHub's tab links write when a reader presses back onto the first tab.
    // A page that refused it would hand the profile back on the way home from the
    // repositories tab.
    expect(readOrThrow("https://github.com/flazouh?tab=overview").tab).toBe("profile")
  })

  test("tells the three tabs apart", () => {
    expect(readOrThrow("https://github.com/flazouh?tab=repositories").tab).toBe("repositories")
    expect(readOrThrow("https://github.com/flazouh?tab=stars").tab).toBe("stars")
  })

  test("refuses the tabs this interface does not draw", () => {
    // Achievements, followers and packages stay GitHub's, so their addresses must
    // read as no page of ours rather than as the profile with an odd parameter.
    expect(read("https://github.com/flazouh?tab=achievements")).toEqual(Option.none())
    expect(read("https://github.com/flazouh?tab=followers")).toEqual(Option.none())
    expect(read("https://github.com/flazouh?tab=projects")).toEqual(Option.none())
  })

  test("is not a repository", () => {
    // Two segments is a repository, including when the second one is a word this
    // parser would otherwise want.
    expect(read("https://github.com/flazouh/gitquiet")).toEqual(Option.none())
    expect(read("https://github.com/flazouh/repositories")).toEqual(Option.none())
  })

  test("is not the reader's own dashboard", () => {
    expect(read("https://github.com/")).toEqual(Option.none())
  })

  test("is not one of the site's own pages", () => {
    // The ones that host a second segment, from the repository parser's list.
    expect(read("https://github.com/notifications")).toEqual(Option.none())
    expect(read("https://github.com/settings")).toEqual(Option.none())
    // And the ones that end where they start, which only a one-segment address
    // meets. Every one of these is a login as far as the path is concerned.
    expect(read("https://github.com/features")).toEqual(Option.none())
    expect(read("https://github.com/pricing")).toEqual(Option.none())
    expect(read("https://github.com/copilot")).toEqual(Option.none())
  })

  test("reads a reserved name whatever its case", () => {
    expect(read("https://github.com/Settings")).toEqual(Option.none())
    expect(read("https://github.com/Pricing")).toEqual(Option.none())
  })

  test("is not somewhere else on the internet", () => {
    expect(read("https://gitlab.com/flazouh")).toEqual(Option.none())
    expect(read("https://github.evil.com/flazouh")).toEqual(Option.none())
  })

  test("carries the page they were on", () => {
    expect(readOrThrow("https://github.com/flazouh?tab=repositories&page=3").page).toBe(3)
  })

  test("reads a page that makes no sense as the first one", () => {
    expect(readOrThrow("https://github.com/flazouh?tab=stars&page=two").page).toBe(1)
    expect(readOrThrow("https://github.com/flazouh?tab=stars&page=0").page).toBe(1)
  })

  test("carries what the reader typed in their find box", () => {
    const page = readOrThrow("https://github.com/flazouh?tab=repositories&q=octo+repo")

    expect(page.find).toBe("octo repo")
  })

  test("keeps every other narrowing without reading it", () => {
    const page = readOrThrow(
      "https://github.com/flazouh?tab=repositories&type=source&language=swift&sort=stargazers"
    )

    expect(page.narrowing).toContain("type=source")
    expect(page.narrowing).toContain("language=swift")
    expect(page.narrowing).toContain("sort=stargazers")
  })

  test("keeps the page out of the narrowing", () => {
    // Paging is the one parameter this interface writes itself, so a page kept here
    // would have a later read ask for page two of page two.
    const page = readOrThrow("https://github.com/flazouh?tab=stars&page=4")

    expect(page.narrowing).not.toContain("page")
  })
})

describe("each of the three, refusing the other two", () => {
  test("the profile", () => {
    expect(Option.isSome(profileIn("https://github.com/flazouh"))).toBe(true)
    expect(profileIn("https://github.com/flazouh?tab=stars")).toEqual(Option.none())
  })

  test("the repositories tab", () => {
    expect(Option.isSome(personReposIn("https://github.com/flazouh?tab=repositories"))).toBe(true)
    expect(personReposIn("https://github.com/flazouh")).toEqual(Option.none())
  })

  test("the stars tab", () => {
    expect(Option.isSome(personStarsIn("https://github.com/flazouh?tab=stars"))).toBe(true)
    expect(personStarsIn("https://github.com/flazouh?tab=repositories")).toEqual(Option.none())
  })
})

describe("the address a later page is read from", () => {
  const page = readOrThrow("https://github.com/flazouh?tab=repositories&q=octo&type=source")

  test("names the tab and the page wanted", () => {
    const route = tabRoute(page, 2)

    expect(route.startsWith("/flazouh?")).toBe(true)
    expect(route).toContain("tab=repositories")
    expect(route).toContain("page=2")
  })

  test("hands every narrowing back as it arrived", () => {
    const route = tabRoute(page, 2)

    expect(route).toContain("q=octo")
    expect(route).toContain("type=source")
  })

  test("leaves the page off the first one", () => {
    // Their own route serves page one without it, and an address that says `page=1`
    // is one more thing for a remembered read to miss on.
    expect(tabRoute(page, 1)).not.toContain("page=")
  })

  test("names the tab even where the reader's address did not", () => {
    // A fetch without it answers with the profile, and a repositories screen that
    // parsed a profile would show nothing with no visible cause.
    const bare = readOrThrow("https://github.com/flazouh")

    expect(tabRoute({ ...bare, tab: "stars" }, 1)).toContain("tab=stars")
  })
})
