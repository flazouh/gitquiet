import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { onTheirShelves, queryFor, type RepoList, repoListIn, seeding } from "./repoList"
import type { InvolvedPullRequest, Shelf } from "./workingSet"

const read = (url: string) => repoListIn(url)
const readOrThrow = (url: string) => Option.getOrThrow(repoListIn(url))

describe("reading a repository's pull request list from its address", () => {
  test("takes the repository out of the path", () => {
    const list = readOrThrow("https://github.com/octo-org/octo-repo/pulls")

    expect(list.repo).toEqual({ owner: "octo-org", repo: "octo-repo" })
    expect(list.page).toBe(1)
  })

  test("carries the reader's own search through", () => {
    // GitHub's filter controls write their state into `q`, and a link somebody
    // sends is mostly that `q`. Dropping it would answer a different question than
    // the one the address asks.
    const list = readOrThrow(
      "https://github.com/o/r/pulls?q=is%3Apr+is%3Aclosed+author%3A%40me"
    )

    expect(list.query).toBe("is:pr is:closed author:@me")
  })

  test("and the page they were on", () => {
    expect(readOrThrow("https://github.com/o/r/pulls?page=4").page).toBe(4)
  })

  test("reads a trailing slash as the same page", () => {
    expect(Option.isSome(read("https://github.com/o/r/pulls/"))).toBe(true)
  })

  test("is not a pull request", () => {
    // `/pull/123` is one pull request and `/pulls` is the list of them. One
    // character apart, and the interface for each is a different page.
    expect(read("https://github.com/o/r/pull/123")).toEqual(Option.none())
  })

  test("is not the Working Set", () => {
    // The dashboard at `/pulls` is a different page with a different question, and
    // its own script already owns it.
    expect(read("https://github.com/pulls")).toEqual(Option.none())
    expect(read("https://github.com/pulls/inbox")).toEqual(Option.none())
  })

  test("is not some other page of a repository", () => {
    expect(read("https://github.com/o/r/issues")).toEqual(Option.none())
    expect(read("https://github.com/o/r")).toEqual(Option.none())
    expect(read("https://github.com/o/r/pulls/comments")).toEqual(Option.none())
  })

  test("is not somewhere else on the internet", () => {
    expect(read("https://gitlab.com/o/r/pulls")).toEqual(Option.none())
  })

  test("reads a page that makes no sense as the first one", () => {
    // Somebody's hand-edited address, or a crawler's. A list that renders nothing
    // because the page was the word "two" is worse than one that renders page one.
    expect(readOrThrow("https://github.com/o/r/pulls?page=two").page).toBe(1)
    expect(readOrThrow("https://github.com/o/r/pulls?page=-3").page).toBe(1)
    expect(readOrThrow("https://github.com/o/r/pulls?page=0").page).toBe(1)
  })
})

describe("the search a repository's list is read with", () => {
  const list = (query: string) => ({
    repo: { owner: "octo-org", repo: "octo-repo" },
    query,
    page: 1
  })

  test("scopes the search to the repository the address named", () => {
    expect(queryFor(list("is:pr is:open"))).toContain("repo:octo-org/octo-repo")
  })

  test("asks only for pull requests", () => {
    // The route this goes to answers about issues as readily as pull requests, and
    // a repository's pull request list showing issues would be a bug nobody could
    // explain from the address.
    expect(queryFor(list(""))).toContain("is:pr")
  })

  test("defaults to open, as their own list does", () => {
    expect(queryFor(list(""))).toContain("is:open")
  })

  test("leaves the state alone when the reader asked for one", () => {
    // `is:open` added on top of `is:closed` is a search that matches nothing, and
    // a list that is empty for a reason the reader cannot see.
    const closed = queryFor(list("is:pr is:closed"))

    expect(closed).toContain("is:closed")
    expect(closed).not.toContain("is:open")
  })

  test("keeps a sort the reader asked for", () => {
    expect(queryFor(list("is:pr is:open sort:created-asc"))).toContain("sort:created-asc")
  })

  test("refuses to be pointed at another repository", () => {
    // A link carrying `repo:` of its own would otherwise make this page show a
    // repository other than the one in its own address — the heading saying one
    // thing and the rows another.
    const asked = queryFor(list("is:pr is:open repo:someone/else"))

    expect(asked).toContain("repo:octo-org/octo-repo")
    expect(asked).not.toContain("someone/else")
  })

  test("drops a second is:pr rather than repeating it", () => {
    expect(queryFor(list("is:pr is:open")).match(/is:pr/g)).toHaveLength(1)
  })
})

describe("writing the reader's own involvement back onto a page of a repository", () => {
  const row = (id: number, over: Partial<InvolvedPullRequest> = {}): InvolvedPullRequest => ({
    reference: { owner: "o", repo: "r", number: id },
    id,
    title: `pull request ${id}`,
    author: { login: "someone", isAutomated: false, faceUrl: Option.none() },
    state: "open",
    shelf: Option.none(),
    why: Option.none(),
    readByViewer: true,
    comments: 0,
    labels: 0,
    assignees: 0,
    openedAt: "2026-07-01T00:00:00Z",
    changedAt: "2026-07-02T00:00:00Z",
    headSha: "abc",
    channels: [],
    checks: Option.none(),
    reviewed: Option.none(),
    size: Option.none(),
    ...over
  })

  const on = (id: number, shelf: Shelf, why?: string) =>
    row(id, { shelf: Option.some(shelf), why: why === undefined ? Option.none() : Option.some(why) })

  test("takes the shelf where the reader is involved in one of them", () => {
    const [first] = onTheirShelves([row(1)], [on(1, "needs-action", "CI_FAILING")])

    expect(first?.shelf).toEqual(Option.some("needs-action"))
    expect(first?.why).toEqual(Option.some("CI_FAILING"))
  })

  test("leaves a stranger's pull request on no shelf", () => {
    const [first] = onTheirShelves([row(2)], [on(1, "needs-action")])

    expect(first?.shelf).toEqual(Option.none())
  })

  test("keeps the more urgent of two shelves", () => {
    // A pull request can be waiting for review and ready to merge at once. Ready to
    // merge is the reader's move, and it is the one worth showing.
    const [first] = onTheirShelves([row(1)], [on(1, "waiting-for-review"), on(1, "ready-to-merge")])

    expect(first?.shelf).toEqual(Option.some("ready-to-merge"))
  })

  test("and does so whichever order the shelves answered in", () => {
    const [first] = onTheirShelves([row(1)], [on(1, "ready-to-merge"), on(1, "waiting-for-review")])

    expect(first?.shelf).toEqual(Option.some("ready-to-merge"))
  })

  test("adds no rows the address did not ask for", () => {
    // The shelves cross repositories and pages. A shelf row appearing on a page
    // whose own search excludes it is a page whose count and paging do not add up.
    const shown = onTheirShelves([row(1)], [on(1, "needs-action"), on(99, "needs-action")])

    expect(shown).toHaveLength(1)
    expect(shown[0]?.id).toBe(1)
  })

  test("keeps everything else the search said about the row", () => {
    // The search knows whether the reader has read it and how many comments it has,
    // and the shelves are only being asked about involvement.
    const [first] = onTheirShelves(
      [row(1, { readByViewer: false, comments: 12, title: "the search's title" })],
      [on(1, "needs-action")]
    )

    expect(first?.readByViewer).toBe(false)
    expect(first?.comments).toBe(12)
    expect(first?.title).toBe("the search's title")
  })
})

describe("what the filter box says when the address carried a search", () => {
  const at = (query: string): RepoList => ({
    repo: { owner: "flowline-labs", repo: "flowline" },
    query,
    page: 1
  })

  const seeded = (query: string) => seeding(at(query))

  test("is empty where the reader asked for nothing", () => {
    expect(seeded("")).toBe("")
  })

  test("says the state, which is the thing the reader most often arrived with", () => {
    expect(seeded("is:merged")).toBe("is:merged")
  })

  test("keeps the terms this box can act on", () => {
    expect(seeded("author:aleks review:approved")).toBe("author:aleks review:approved")
  })

  test("drops the terms this box would read as words to find in a title", () => {
    // The search already sorted and labelled the rows. Putting these in the box
    // would empty a list of three hundred and blame the reader for it.
    expect(seeded("is:merged sort:updated-desc label:bug milestone:v2")).toBe("is:merged")
  })

  test("drops the terms the page owns, which the search dropped too", () => {
    expect(seeded("repo:someone/else is:issue is:merged")).toBe("is:merged")
  })

  test("never says a term the search did not carry", () => {
    // The box and the search have to agree about what narrowed this page.
    const query = "is:merged author:bob sort:updated label:bug repo:someone/else"
    const carried = queryFor(at(query))

    for (const term of seeded(query).split(" ").filter((one) => one.length > 0)) {
      expect(carried).toContain(term)
    }
  })
})
