import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  type History,
  type Landed,
  type Mark,
  authorIn,
  byAuthor,
  commitListIn,
  pageAfter,
  pageBefore,
  proposalIn,
  routeFor,
  sinceIn,
  sinceWhen,
  withMarks
} from "./commitList"

const parsed = (url: string) => Option.getOrNull(commitListIn(url))

const at = (path: string) => `https://github.com${path}`

describe("the address of a branch's commits", () => {
  test("reads the owner, the repository and the branch out of it", () => {
    expect(parsed(at("/flazouh/githubpro/commits/main"))).toEqual({
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: Option.some("main"),
      search: ""
    })
  })

  test("does not mind a trailing slash, which is how their own links are written", () => {
    expect(parsed(at("/flazouh/githubpro/commits/main/"))?.branch).toEqual(Option.some("main"))
  })

  test("names no branch where the address names none, which is their default one", () => {
    expect(parsed(at("/flazouh/githubpro/commits"))?.branch).toEqual(Option.none())
  })

  test("carries whatever the pager wrote, so the second page is reachable", () => {
    expect(parsed(at("/flazouh/githubpro/commits/main?after=9f0c4c6+34"))?.search).toBe(
      "after=9f0c4c6+34"
    )
  })

  test("carries their filters too, which are theirs to spell", () => {
    expect(parsed(at("/flazouh/githubpro/commits/main?author=flazouh&since=2026-01-01"))?.search).toBe(
      "author=flazouh&since=2026-01-01"
    )
  })

  test("is not a file's history, which names a path after the branch", () => {
    // `/commits/main/src/app.ts` and `/commits/feature/login` are the same shape,
    // and only the repository's branch list tells them apart. Refusing both is
    // wrong about slashed branches and right about every file, and being wrong
    // here leaves GitHub's own page standing rather than drawing the wrong one.
    expect(parsed(at("/flazouh/githubpro/commits/main/src/app.ts"))).toBeNull()
  })

  test("is not one commit, which is a page about a single one", () => {
    expect(parsed(at("/flazouh/githubpro/commit/9f0c4c6"))).toBeNull()
  })

  test("is not a pull request's own commits, which that page already holds", () => {
    expect(parsed(at("/flazouh/githubpro/pull/12/commits"))).toBeNull()
  })

  test("is not another site that happens to end this way", () => {
    expect(parsed("https://example.com/flazouh/githubpro/commits/main")).toBeNull()
  })
})

describe("the route that reads a page of them", () => {
  test("asks for the branch the address named", () => {
    expect(
      routeFor({
        repo: { owner: "flazouh", repo: "githubpro" },
        branch: Option.some("main"),
        search: ""
      })
    ).toBe("/commits/main")
  })

  test("asks for the default branch by leaving it unnamed", () => {
    expect(
      routeFor({
        repo: { owner: "flazouh", repo: "githubpro" },
        branch: Option.none(),
        search: ""
      })
    ).toBe("/commits")
  })

  test("hands their cursor straight back to them", () => {
    expect(
      routeFor({
        repo: { owner: "flazouh", repo: "githubpro" },
        branch: Option.some("main"),
        search: "after=9f0c4c6+34"
      })
    ).toBe("/commits/main?after=9f0c4c6+34")
  })

  test("encodes a branch whose name would otherwise read as more path", () => {
    expect(
      routeFor({
        repo: { owner: "flazouh", repo: "githubpro" },
        branch: Option.some("release#1"),
        search: ""
      })
    ).toBe("/commits/release%231")
  })
})

describe("narrowing a branch's commits", () => {
  const list = {
    repo: { owner: "flazouh", repo: "githubpro" },
    branch: Option.some("main"),
    search: ""
  }

  test("filters to one person's commits, by the word their own page uses", () => {
    expect(byAuthor(list, Option.some("flazouh"))).toBe(
      "/flazouh/githubpro/commits/main?author=flazouh"
    )
  })

  test("takes the filter off again, leaving no empty parameter behind", () => {
    expect(byAuthor({ ...list, search: "author=flazouh" }, Option.none())).toBe(
      "/flazouh/githubpro/commits/main"
    )
  })

  test("drops the cursor when the filter changes, since it points into the old list", () => {
    expect(byAuthor({ ...list, search: "after=1111111+34" }, Option.some("octo"))).toBe(
      "/flazouh/githubpro/commits/main?author=octo"
    )
  })

  test("keeps the other filter, because the two narrow together", () => {
    expect(byAuthor({ ...list, search: "since=2026-01-01" }, Option.some("octo"))).toBe(
      "/flazouh/githubpro/commits/main?since=2026-01-01&author=octo"
    )
  })

  test("says who the address is already narrowed to", () => {
    expect(authorIn({ ...list, search: "author=flazouh" })).toEqual(Option.some("flazouh"))
    expect(authorIn(list)).toEqual(Option.none())
  })

  test("filters to what landed since a date", () => {
    expect(sinceWhen(list, Option.some("2026-07-01"))).toBe(
      "/flazouh/githubpro/commits/main?since=2026-07-01"
    )
  })

  test("says which date the address is already narrowed to", () => {
    expect(sinceIn({ ...list, search: "since=2026-07-01" })).toEqual(Option.some("2026-07-01"))
    expect(sinceIn(list)).toEqual(Option.none())
  })
})

describe("the address of the next page", () => {
  test("keeps the branch and every filter, and moves the cursor", () => {
    const list = {
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: Option.some("main"),
      search: "author=flazouh"
    }

    expect(pageAfter(list, "9f0c4c6 34")).toBe(
      "/flazouh/githubpro/commits/main?author=flazouh&after=9f0c4c6+34"
    )
  })

  test("replaces a cursor already in the address rather than adding a second", () => {
    const list = {
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: Option.some("main"),
      search: "after=1111111+34"
    }

    expect(pageAfter(list, "2222222 68")).toBe("/flazouh/githubpro/commits/main?after=2222222+68")
  })

  test("drops the other cursor, since a page is read in one direction", () => {
    const list = {
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: Option.some("main"),
      search: "before=1111111+0"
    }

    expect(pageAfter(list, "2222222 34")).toBe("/flazouh/githubpro/commits/main?after=2222222+34")
  })

  test("goes back the same way, by the cursor at the other end", () => {
    const list = {
      repo: { owner: "flazouh", repo: "githubpro" },
      branch: Option.some("main"),
      search: "after=2222222+34"
    }

    expect(pageBefore(list, "1111111 0")).toBe("/flazouh/githubpro/commits/main?before=1111111+0")
  })
})

describe("the pull request a commit landed as", () => {
  test("reads the number their squash writes at the end of the subject", () => {
    expect(proposalIn("[Fiber] Collect Host Singleton children (#37063)")).toEqual(
      Option.some(37063)
    )
  })

  test("reads the number their merge writes at the start of it", () => {
    expect(proposalIn("Merge pull request #412 from flazouh/quiet-corners")).toEqual(
      Option.some(412)
    )
  })

  test("finds none where a subject only mentions one", () => {
    // A commit that says it fixes issue #7 did not land as pull request 7, and a
    // row linking it to one would be a link to somebody else's work.
    expect(proposalIn("Fix the crash reported in #7")).toEqual(Option.none())
  })

  test("finds none on a commit pushed straight to the branch", () => {
    expect(proposalIn("Tidy the gate stylesheet")).toEqual(Option.none())
  })
})

const landed = (sha: string): Landed => ({
  sha,
  abbreviatedSha: sha.slice(0, 7),
  headline: `commit ${sha}`,
  bodyHtml: Option.none(),
  authors: [],
  committer: Option.none(),
  pullRequest: Option.none(),
  createdAt: "2026-08-01T10:00:00Z",
  mark: Option.none(),
  stat: Option.none()
})

const page = (...shas: ReadonlyArray<string>): History => ({
  branch: "main",
  days: [{ title: "Aug 1, 2026", commits: shas.map(landed) }],
  older: Option.none(),
  newer: Option.none(),
  rest: Option.none()
})

const passing: Mark = {
  checks: Option.some({ state: "passing", said: "251 / 252 checks OK" }),
  verified: true,
  comments: 0
}

describe("what the second read adds to a page already on the screen", () => {
  test("puts each answer on the commit it is about", () => {
    const marked = withMarks(page("aaaaaaa1", "bbbbbbb2"), new Map([["aaaaaaa1", passing]]))
    const [first, second] = marked.days[0]?.commits ?? []

    expect(first?.mark).toEqual(Option.some(passing))
    expect(second?.mark).toEqual(Option.none())
  })

  test("leaves a commit it said nothing about unmarked rather than marking it clear", () => {
    // "Not answered yet" and "no checks ran" are different sentences. A row that
    // draws the second for the first says an untested branch is green.
    const marked = withMarks(page("aaaaaaa1"), new Map())

    expect(marked.days[0]?.commits[0]?.mark).toEqual(Option.none())
  })

  test("keeps the days, the branch and both cursors", () => {
    const before = page("aaaaaaa1")
    const after = withMarks(before, new Map([["aaaaaaa1", passing]]))

    expect(after.branch).toBe(before.branch)
    expect(after.days).toHaveLength(1)
    expect(after.days[0]?.title).toBe("Aug 1, 2026")
  })
})
