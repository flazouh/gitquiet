import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { issueListIn } from "./issueList"
import { INVOLVEMENTS } from "./issues"
import { issueDashboardIn, pathOf, queryFor, seeding } from "./issueDashboard"

const at = (path: string) => `https://github.com${path}`

const parsed = (url: string) => Option.getOrNull(issueDashboardIn(url))

describe("the address of everything the reader is party to", () => {
  test("reads which of the three questions the address asks", () => {
    expect(parsed(at("/issues/assigned"))?.involvement).toBe("assigned")
    expect(parsed(at("/issues/created"))?.involvement).toBe("authored")
    expect(parsed(at("/issues/mentioned"))?.involvement).toBe("mentioned")
  })

  test("answers the bare address with the question GitHub opens on", () => {
    // `/issues` is their own link and it lands on Assigned. Answering it with
    // nothing would leave their page standing on the address they publish.
    expect(parsed(at("/issues"))?.involvement).toBe("assigned")
    expect(parsed(at("/issues/"))?.involvement).toBe("assigned")
  })

  test("carries their search verbatim, because the vocabulary is theirs", () => {
    expect(parsed(at("/issues/assigned?q=is%3Aclosed+label%3Abug"))?.query).toBe(
      "is:closed label:bug"
    )
  })

  test("reads the page their pager wrote", () => {
    expect(parsed(at("/issues/created?page=3"))?.page).toBe(3)
  })

  test("answers a page that is not a page with the first one", () => {
    expect(parsed(at("/issues?page=nonsense"))?.page).toBe(1)
    expect(parsed(at("/issues?page=0"))?.page).toBe(1)
  })

  test("is not a repository's own issues, which names one", () => {
    expect(parsed(at("/flowline-labs/flowline/issues"))).toBeNull()
    expect(parsed(at("/flowline-labs/flowline/issues/7"))).toBeNull()
  })

  test("is not a view of theirs this extension has no question for", () => {
    // Their own tab row has more than three on it — `Recent activity` was read
    // off the live page beside the three. A view nothing here can ask about is
    // left to GitHub rather than answered with the wrong list.
    expect(parsed(at("/issues/recent"))).toBeNull()
    expect(parsed(at("/issues/subscribed"))).toBeNull()
  })

  test("is not the repository issue list, which the other parser reads", () => {
    // Two parsers run one after the other in the shell, so the one that would
    // claim the other's address is the one worth pinning.
    expect(Option.isSome(issueListIn(at("/issues/assigned")))).toBe(false)
    expect(parsed(at("/flowline-labs/flowline/issues"))).toBeNull()
  })

  test("is not another site that happens to end this way", () => {
    expect(parsed("https://example.com/issues/assigned")).toBeNull()
  })
})

describe("the search that reads one page of them", () => {
  const dash = (involvement: "assigned" | "authored" | "mentioned", query = "") => ({
    involvement,
    query,
    page: 1
  })

  test("asks each question by GitHub's own word for it", () => {
    expect(queryFor(dash("assigned"))).toBe("assignee:@me is:issue is:open")
    expect(queryFor(dash("authored"))).toBe("author:@me is:issue is:open")
    expect(queryFor(dash("mentioned"))).toBe("mentions:@me is:issue is:open")
  })

  test("keeps whatever else the reader asked for", () => {
    expect(queryFor(dash("assigned", "label:bug sort:created-asc"))).toBe(
      "assignee:@me is:issue is:open label:bug sort:created-asc"
    )
  })

  test("leaves the state alone once the reader has named one", () => {
    expect(queryFor(dash("assigned", "is:closed"))).toBe("assignee:@me is:issue is:closed")
  })

  test("refuses a question the tab did not ask", () => {
    // The tab says who this list is about. A second `assignee:` from the query
    // would point the rows at somebody else with nothing on the page saying so.
    expect(queryFor(dash("assigned", "author:someone-else"))).toBe(
      "assignee:@me is:issue is:open"
    )
  })

  test("refuses a kind, because this page is issues and their route answers both", () => {
    expect(queryFor(dash("assigned", "is:pr"))).toBe("assignee:@me is:issue is:open")
  })
})

describe("what the filter box says when the address carried a search", () => {
  const seeded = (query: string) => seeding({ involvement: "assigned", query, page: 1 })

  test("is empty where the reader asked for nothing", () => {
    expect(seeded("")).toBe("")
  })

  test("says the state, which is the thing the reader most often arrived with", () => {
    expect(seeded("is:closed")).toBe("is:closed")
  })

  test("drops the terms this box would read as words to find in a title", () => {
    // The search already sorted and labelled the rows. Putting these in the box
    // would empty a list of three hundred and blame the reader for it.
    expect(seeded("is:closed sort:created-asc label:bug")).toBe("is:closed")
  })

  test("drops the terms the tab owns, which the search dropped too", () => {
    // The box and the search have to agree about what narrowed this page.
    expect(seeded("assignee:someone-else is:closed")).toBe("is:closed")
  })

  test("never says a term the search did not carry", () => {
    const query = "is:closed author:bob sort:updated label:bug is:pr"
    const carried = queryFor({ involvement: "assigned", query, page: 1 })

    for (const term of seeded(query).split(" ").filter((one) => one.length > 0)) {
      expect(carried).toContain(term)
    }
  })
})

describe("where each of the three tabs goes", () => {
  test("is GitHub's own address for it, so a reload lands where the reader is", () => {
    expect(pathOf("assigned")).toBe("/issues/assigned")
    expect(pathOf("authored")).toBe("/issues/created")
    expect(pathOf("mentioned")).toBe("/issues/mentioned")
  })

  test("is an address this same parser reads back", () => {
    // The round trip is the point: a tab that goes somewhere the parser refuses
    // is a tab that hands the page back to GitHub.
    for (const involvement of INVOLVEMENTS) {
      expect(parsed(at(pathOf(involvement)))?.involvement).toBe(involvement)
    }
  })
})
