import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { type IssueList, issueListIn, queryFor, seeding } from "./issueList"

const at = (path: string) => `https://github.com${path}`

const parsed = (url: string) => Option.getOrNull(issueListIn(url))

describe("the address of a repository's issues", () => {
  test("reads the owner and the repository out of it", () => {
    expect(parsed(at("/flowline-labs/flowline/issues"))).toEqual({
      repo: { owner: "flowline-labs", repo: "flowline" },
      query: "",
      page: 1
    })
  })

  test("does not mind a trailing slash, which is how some of their links are written", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/"))?.repo).toEqual({
      owner: "flowline-labs",
      repo: "flowline"
    })
  })

  test("carries their search verbatim, because the vocabulary is theirs", () => {
    expect(parsed(at("/flowline-labs/flowline/issues?q=is%3Aopen+label%3Abug"))?.query).toBe(
      "is:open label:bug"
    )
  })

  test("reads the page their pager wrote", () => {
    expect(parsed(at("/flowline-labs/flowline/issues?page=4"))?.page).toBe(4)
  })

  test("answers a page that is not a page with the first one", () => {
    // A hand-edited address is worth answering with the first page rather than
    // with nothing at all.
    expect(parsed(at("/flowline-labs/flowline/issues?page=nonsense"))?.page).toBe(1)
    expect(parsed(at("/flowline-labs/flowline/issues?page=0"))?.page).toBe(1)
  })

  test("is not one issue, which is a different page with a screen of its own", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/2137"))).toBeNull()
  })

  test("is not the form for raising one", () => {
    expect(parsed(at("/flowline-labs/flowline/issues/new"))).toBeNull()
  })

  test("is not the repository's pull requests, which is one character different", () => {
    expect(parsed(at("/flowline-labs/flowline/pulls"))).toBeNull()
  })

  test("is not the global issue dashboard, which names no repository", () => {
    expect(parsed(at("/issues"))).toBeNull()
    expect(parsed(at("/issues/assigned"))).toBeNull()
  })

  test("is not another site that happens to end this way", () => {
    expect(parsed("https://example.com/flowline-labs/flowline/issues")).toBeNull()
  })
})

describe("the search that reads one page of them", () => {
  const list = (query: string) => ({
    repo: { owner: "flowline-labs", repo: "flowline" },
    query,
    page: 1
  })

  test("names the repository and asks for issues only", () => {
    expect(queryFor(list(""))).toBe("repo:flowline-labs/flowline is:issue is:open")
  })

  test("keeps whatever else the reader asked for", () => {
    expect(queryFor(list("label:bug sort:created-asc"))).toBe(
      "repo:flowline-labs/flowline is:issue is:open label:bug sort:created-asc"
    )
  })

  test("leaves the state alone once the reader has named one", () => {
    // `is:open` on top of `is:closed` matches nothing, and an empty list with no
    // visible cause is the worst answer available.
    expect(queryFor(list("is:closed"))).toBe("repo:flowline-labs/flowline is:issue is:closed")
  })

  test("refuses a repository the address did not name", () => {
    // The heading says one repository. A `repo:` in the query would point the
    // rows at another, and nothing on the page would say so.
    expect(queryFor(list("repo:react/react"))).toBe("repo:flowline-labs/flowline is:issue is:open")
  })

  test("refuses a kind, because this page is issues and their route answers both", () => {
    expect(queryFor(list("is:pr"))).toBe("repo:flowline-labs/flowline is:issue is:open")
  })
})

describe("what the filter box says when the address carried a search", () => {
  const at = (query: string): IssueList => ({
    repo: { owner: "flowline-labs", repo: "flowline" },
    query,
    page: 1
  })

  const seeded = (query: string) => seeding(at(query))

  test("is empty where the reader asked for nothing", () => {
    expect(seeded("")).toBe("")
  })

  test("says the state, which is the thing the reader most often arrived with", () => {
    expect(seeded("is:closed")).toBe("is:closed")
  })

  test("keeps the author, which this box can act on", () => {
    expect(seeded("is:closed author:aleks")).toBe("is:closed author:aleks")
  })

  test("drops the terms this box would read as words to find in a title", () => {
    // The search already sorted and labelled the rows. Putting these in the box
    // would empty a list of three hundred and blame the reader for it.
    expect(seeded("is:closed sort:created-asc label:bug no:assignee")).toBe("is:closed")
  })

  test("drops the terms the page owns, which the search dropped too", () => {
    expect(seeded("repo:someone/else is:pr is:closed")).toBe("is:closed")
  })

  test("never says a term the search did not carry", () => {
    // The box and the search have to agree about what narrowed this page.
    const query = "is:closed author:bob sort:updated label:bug repo:someone/else"
    const carried = queryFor(at(query))

    for (const term of seeded(query).split(" ").filter((one) => one.length > 0)) {
      expect(carried).toContain(term)
    }
  })
})
