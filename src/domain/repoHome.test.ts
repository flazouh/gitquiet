import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  type Entry,
  type Footing,
  type Kind,
  type Touch,
  inReadingOrder,
  leadFor,
  repoHomeIn,
  touchedBy
} from "./repoHome"

const parsed = (url: string) => Option.getOrNull(repoHomeIn(url))

const at = (path: string) => `https://github.com${path}`

describe("the address of a repository's front page", () => {
  test("reads the owner and the repository out of it", () => {
    expect(parsed(at("/flazouh/githubpro"))).toEqual({
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: null,
      reading: null
    })
  })

  test("does not mind a trailing slash, which is how their own links are written", () => {
    expect(parsed(at("/flazouh/githubpro/"))?.repo.repo).toBe("githubpro")
  })

  test("is still the front page when their README anchor rewrote the address", () => {
    expect(parsed(at("/flazouh/githubpro?tab=readme-ov-file"))?.repo.repo).toBe("githubpro")
  })

  test("refuses a tab of the repository, which is a page of its own", () => {
    expect(parsed(at("/flazouh/githubpro/pulls"))).toBeNull()
    expect(parsed(at("/flazouh/githubpro/issues"))).toBeNull()
    expect(parsed(at("/flazouh/githubpro/commits/main"))).toBeNull()
  })

  /*
   * The tree and the blob are this page too, and claiming them is what makes the
   * branch picker and the file pane possible: both are this screen showing
   * something else, and a screen that hands the document back to GitHub to show
   * one file has thrown away the tree beside it.
   */
  test("reads a branch out of a tree address", () => {
    expect(parsed(at("/flazouh/githubpro/tree/quiet-corners"))).toEqual({
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: "quiet-corners",
      reading: null
    })
  })

  test("reads the branch and the file out of a blob address", () => {
    expect(parsed(at("/flazouh/githubpro/blob/main/src/ui/Field.tsx"))).toEqual({
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: "main",
      reading: "src/ui/Field.tsx"
    })
  })

  test("puts a path back together out of the segments GitHub split it into", () => {
    expect(parsed(at("/flazouh/githubpro/tree/main/docs/spec"))?.reading).toBe("docs/spec")
  })

  test("gives back a path that had a space or a hash in it, not the escaped form", () => {
    expect(parsed(at("/flazouh/githubpro/blob/main/docs/a%20b%23c.md"))?.reading).toBe(
      "docs/a b#c.md"
    )
  })

  test("names no branch on the front page itself, because GitHub has not said which yet", () => {
    expect(parsed(at("/flazouh/githubpro"))?.branch).toBeNull()
  })

  test("refuses a tree or blob address with no branch on it", () => {
    expect(parsed(at("/flazouh/githubpro/tree"))).toBeNull()
    expect(parsed(at("/flazouh/githubpro/blob"))).toBeNull()
  })

  test("refuses a profile, which names no repository", () => {
    expect(parsed(at("/flazouh"))).toBeNull()
  })

  test("refuses another host, because this runs on every page a script is matched into", () => {
    expect(parsed("https://gitlab.com/flazouh/githubpro")).toBeNull()
  })

  /*
   * The whole reason this parser needs a list. Every other page of this extension
   * is told apart by a segment GitHub owns — `pulls`, `commits`, `issues` — and this
   * one is told apart by there being no such segment at all, so every two-segment
   * address on the site arrives here first.
   */
  test("refuses the site's own two-segment pages, which are not repositories", () => {
    for (const path of [
      "/issues/assigned",
      "/pulls/review-requested",
      "/settings/profile",
      "/orgs/community",
      "/topics/typescript",
      "/sponsors/sindresorhus",
      "/apps/dependabot",
      "/notifications/subscriptions",
      "/codespaces/new",
      "/search/advanced"
    ]) {
      expect(parsed(at(path))).toBeNull()
    }
  })

  test("does not refuse a repository whose owner merely resembles one of them", () => {
    expect(parsed(at("/settings-ui/kit"))?.repo.owner).toBe("settings-ui")
  })
})

describe("what the page leads with", () => {
  const footing = (can: boolean): Footing => (can ? "keeper" : "caller")

  test("leads a caller with the welcome, because they came to find out what this is", () => {
    expect(leadFor(footing(false))).toBe("welcome")
  })

  test("leads a keeper with the work, because they already know and came to reach a file", () => {
    expect(leadFor(footing(true))).toBe("work")
  })
})

const entry = (name: string, kind: Kind = "file"): Entry => ({
  name,
  path: name,
  kind,
  touched: Option.none()
})

describe("the order of the file list", () => {
  test("puts folders above files, which is where a reader looks for them", () => {
    const sorted = inReadingOrder([entry("readme.md"), entry("src", "directory"), entry("a.ts")])
    expect(sorted.map((one) => one.name)).toEqual(["src", "a.ts", "readme.md"])
  })

  test("does not mind case, so one repository does not sort unlike the next", () => {
    const sorted = inReadingOrder([entry("zoo.ts"), entry("Apple.ts")])
    expect(sorted.map((one) => one.name)).toEqual(["Apple.ts", "zoo.ts"])
  })

  test("counts numbers, so the tenth follows the ninth", () => {
    const sorted = inReadingOrder([entry("v10.ts"), entry("v9.ts")])
    expect(sorted.map((one) => one.name)).toEqual(["v9.ts", "v10.ts"])
  })
})

describe("the commit column", () => {
  const touch: Touch = { at: "2026-07-07T00:20:39.000+02:00", said: "fix the thing", url: "/c/1" }

  test("writes onto the row of the same path", () => {
    const [written] = touchedBy([entry("a.ts")], new Map([["a.ts", touch]]))
    expect(written?.touched).toEqual(Option.some(touch))
  })

  test("leaves a row the second answer said nothing about alone", () => {
    const [written] = touchedBy([entry("a.ts")], new Map())
    expect(written?.touched).toEqual(Option.none())
  })

  test("goes by path rather than position, because the two answers are separate reads", () => {
    const rows = touchedBy([entry("a.ts"), entry("b.ts")], new Map([["b.ts", touch]]))
    expect(rows.map((one) => Option.isSome(one.touched))).toEqual([false, true])
  })
})
