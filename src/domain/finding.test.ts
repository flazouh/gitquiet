import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { finding, owedIn } from "./finding"
import type { Repository } from "./repositories"

const repository = (nameWithOwner: string): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false
  }
}

const REPOSITORIES = [
  repository("flowline-labs/flowline"),
  repository("flazouh/gitquiet"),
  repository("flazouh/ego-browser"),
  repository("someone/flowline-forms")
]

const owed = [
  {
    kind: "pull-request" as const,
    reference: { owner: "flowline-labs", repo: "flowline", number: 1934 },
    title: "feat(design-system): canonical component library"
  },
  {
    kind: "issue" as const,
    reference: { owner: "flazouh", repo: "gitquiet", number: 88 },
    title: "Render flat source previews and dismiss voice picker"
  }
]

describe("finding something to open", () => {
  test("offers what is owed before every repository, when nothing is typed", () => {
    const found = finding("", { repositories: REPOSITORIES, owed })

    expect(found.slice(0, 2).map((one) => one.name)).toEqual([
      "feat(design-system): canonical component library",
      "Render flat source previews and dismiss voice picker"
    ])
    expect(found.length).toBeGreaterThan(2)
  })

  test("searches every repository, not the handful GitHub calls recent", () => {
    // The Hacker News complaint, in one assertion: their own box answers about recent
    // repositories only, and the one being looked for is never among them.
    expect(finding("ego", { repositories: REPOSITORIES, owed }).map((one) => one.name)).toEqual([
      "flazouh/ego-browser"
    ])
  })

  test("puts a name that starts with what was typed above one that merely contains it", () => {
    expect(
      finding("flowl", { repositories: REPOSITORIES, owed: [] }).map((one) => one.name)
    ).toEqual(["flowline-labs/flowline", "someone/flowline-forms"])
  })

  test("finds a pull request by its number, with or without the hash", () => {
    expect(finding("#1934", { repositories: REPOSITORIES, owed })[0]?.where).toBe(
      "/flowline-labs/flowline/pull/1934"
    )
    expect(finding("1934", { repositories: REPOSITORIES, owed })[0]?.where).toBe(
      "/flowline-labs/flowline/pull/1934"
    )
  })

  test("finds what is owed by its title, and says which repository it is in", () => {
    const [first] = finding("voice picker", { repositories: REPOSITORIES, owed })

    expect(first?.name).toBe("Render flat source previews and dismiss voice picker")
    expect(first?.detail).toBe("flazouh/gitquiet #88")
    expect(first?.where).toBe("/flazouh/gitquiet/issues/88")
  })

  test("sends a repository to its pull requests, which is a page we draw", () => {
    expect(finding("gitquiet", { repositories: REPOSITORIES, owed: [] })[0]?.where).toBe(
      "/flazouh/gitquiet/pulls"
    )
  })

  test("takes several words in any order", () => {
    expect(
      finding("browser flazouh", { repositories: REPOSITORIES, owed: [] }).map((one) => one.name)
    ).toEqual(["flazouh/ego-browser"])
  })

  test("answers nothing rather than everything when nothing matches", () => {
    expect(finding("zzzz", { repositories: REPOSITORIES, owed })).toEqual([])
  })

  test("keeps the list to a dialog's worth, however much is typed", () => {
    const many = Array.from({ length: 200 }, (_, at) => repository(`owner/repo-${at}`))

    expect(finding("repo", { repositories: many, owed: [] }).length).toBeLessThanOrEqual(20)
  })
})

describe("what the Working Set is owed, as the palette searches it", () => {
  const involved = (owner: string, repo: string, number: number, title: string) => ({
    reference: { owner, repo, number },
    id: number,
    title,
    author: { login: "someone", faceUrl: Option.none() },
    state: "open" as const,
    involvement: Option.none(),
    comments: 0,
    labels: 0,
    raisedAt: "2026-07-01T00:00:00Z"
  })

  const SITTINGS = [
    {
      court: "your-move" as const,
      piles: [
        {
          one: involved("flazouh", "gitquiet", 12, "the foundation"),
          court: "your-move" as const,
          above: [
            {
              one: involved("flazouh", "gitquiet", 13, "the one stacked on it"),
              court: "waiting" as const,
              above: []
            }
          ]
        }
      ],
      issues: [involved("flazouh", "gitquiet", 44, "an issue in the same Court")],
      count: 3
    }
  ]

  test("takes the pull requests, the ones stacked on them, and the issues", () => {
    expect(owedIn(SITTINGS).map((one) => one.title)).toEqual([
      "the foundation",
      "the one stacked on it",
      "an issue in the same Court"
    ])
  })

  test("keeps which kind each is, because they live at different addresses", () => {
    expect(owedIn(SITTINGS).map((one) => one.kind)).toEqual([
      "pull-request",
      "pull-request",
      "issue"
    ])
  })
})

describe("a bare number, on a page that is already inside a repository", () => {
  const inside = { owner: "flowline-labs", repo: "flowline" }

  test("offers that number in this repository, before anything else", () => {
    const [first] = finding("1934", { repositories: REPOSITORIES, owed: [], inside })

    expect(first?.name).toBe("#1934")
    expect(first?.detail).toBe("flowline-labs/flowline")
    expect(first?.where).toBe("/flowline-labs/flowline/pull/1934")
  })

  test("takes the hash as the same thing, because that is how a number is written", () => {
    expect(finding("#12", { repositories: [], owed: [], inside })[0]?.where).toBe(
      "/flowline-labs/flowline/pull/12"
    )
  })

  test("offers it once, where the reader is already owed that very pull request", () => {
    const found = finding("1934", { repositories: REPOSITORIES, owed, inside })

    expect(found.filter((one) => one.where === "/flowline-labs/flowline/pull/1934").length).toBe(1)
    expect(found[0]?.name).toBe("feat(design-system): canonical component library")
  })

  test("says nothing extra for words, which are not numbers", () => {
    expect(finding("ego", { repositories: REPOSITORIES, owed: [], inside })[0]?.name).toBe(
      "flazouh/ego-browser"
    )
  })
})

describe("the repository the reader is standing in", () => {
  const inGitquiet = { owner: "flazouh", repo: "gitquiet" }

  test("comes first when nothing is typed, being the one they are looking at", () => {
    const found = finding("", { repositories: REPOSITORIES, owed, inside: inGitquiet })

    expect(found[0]?.name).toBe("Render flat source previews and dismiss voice picker")
    expect(found[1]?.name).toBe("flazouh/gitquiet")
  })

  test("keeps the rest in the order they came, rather than sorting the whole list", () => {
    // Everything else is still what is owed before every repository. One list is lifted;
    // nothing else moves, because a palette that reshuffles is a palette nobody learns.
    const found = finding("", { repositories: REPOSITORIES, owed, inside: inGitquiet })

    expect(found.slice(2).map((one) => one.name)).toEqual([
      "feat(design-system): canonical component library",
      "flowline-labs/flowline",
      "flazouh/ego-browser",
      "someone/flowline-forms"
    ])
  })

  test("breaks a tie in its own favour, and never a better match elsewhere", () => {
    /*
     * "flo" starts the name of a repository in another account, and nothing in gitquiet
     * matches it at all. Being where the reader stands is worth a tie, not a ranking: a
     * palette that answered the wrong repository first would be worse than one that ignores
     * where they are.
     */
    const found = finding("flo", { repositories: REPOSITORIES, owed, inside: inGitquiet })

    expect(found[0]?.name).toBe("flowline-labs/flowline")
  })

  test("lifts what is owed in it above what is owed elsewhere, at the same nearness", () => {
    const alike = [
      {
        kind: "pull-request" as const,
        reference: { owner: "flowline-labs", repo: "flowline", number: 12 },
        title: "Render the thing"
      },
      {
        kind: "pull-request" as const,
        reference: { owner: "flazouh", repo: "gitquiet", number: 13 },
        title: "Render the thing"
      }
    ]

    const found = finding("render", { repositories: REPOSITORIES, owed: alike, inside: inGitquiet })

    expect(found[0]?.detail).toBe("flazouh/gitquiet #13")
  })

  test("says nothing about anywhere, on a page inside nothing", () => {
    const found = finding("", { repositories: REPOSITORIES, owed })

    expect(found[0]?.name).toBe("feat(design-system): canonical component library")
  })
})
