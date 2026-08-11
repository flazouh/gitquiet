import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { activityIn, howMuchHappened, type Happening } from "./activity"

const happening = (
  kind: Happening["kind"],
  nameWithOwner: string,
  at: string,
  who = "someone",
  branch = "main"
): Happening => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    kind,
    at,
    by: [{ login: who, faceUrl: Option.none() }],
    repo: { owner, repo },
    ref: kind === "pushed" ? Option.some(branch) : Option.none(),
    howMany: Option.none(),
    howOften: 1,
    number: Option.none(),
    title: Option.none(),
    url: `https://github.com/${nameWithOwner}`
  }
}

describe("arranging what happened for reading", () => {
  test("gives each repository one section rather than one line per event", () => {
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T20:00:00Z", "someone", "one"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T19:00:00Z", "someone", "another"),
      happening("opened", "acme/web", "2026-07-31T18:00:00Z")
    ])

    expect(arranged).toHaveLength(2)
    expect(arranged[0]?.repo.repo).toBe("octo-repo")
    expect(arranged[0]?.happenings ?? []).toHaveLength(2)
  })

  test("puts the repository that stirred most recently first", () => {
    const arranged = activityIn([
      happening("pushed", "quiet/one", "2026-07-30T09:00:00Z"),
      happening("pushed", "busy/one", "2026-07-31T23:00:00Z")
    ])

    expect(arranged.map((one) => one.repo.owner)).toEqual(["busy", "quiet"])
  })

  test("orders what happened inside a repository newest first too", () => {
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T10:00:00Z", "someone", "one"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T22:00:00Z", "someone", "another")
    ])

    expect((arranged[0]?.happenings ?? []).map((one) => one.at)).toEqual([
      "2026-07-31T22:00:00Z",
      "2026-07-31T10:00:00Z"
    ])
  })

  test("never ranks: a repository with one push outranks one with ten older ones", () => {
    // Ranking is the thing being undone. Their own feed answered with no pushes at all and
    // two recommendations; this stays in time order however little happened.
    const older = Array.from({ length: 10 }, (_nothing, at) =>
      happening("pushed", "loud/one", `2026-07-30T0${at}:00:00Z`)
    )
    const arranged = activityIn([...older, happening("pushed", "new/one", "2026-07-31T08:00:00Z")])

    expect(arranged[0]?.repo.owner).toBe("new")
  })
})

describe("a crowd doing one thing", () => {
  test("says fourteen stars once, keeping who starred", () => {
    const stars = Array.from({ length: 14 }, (_nothing, at) =>
      happening("starred", "flazouh/octo-repo", `2026-07-31T1${at % 10}:00:00Z`, `person-${at}`)
    )

    const arranged = activityIn(stars)

    expect(arranged[0]?.happenings ?? []).toHaveLength(1)
    expect(arranged[0]?.happenings[0]?.by ?? []).toHaveLength(14)
  })

  test("counts the same person starring twice once", () => {
    const arranged = activityIn([
      happening("starred", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "alex"),
      happening("starred", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "alex")
    ])

    expect(arranged[0]?.happenings[0]?.by.map((who) => who.login)).toEqual(["alex"])
  })

  test("says one person's run of pushes to a branch once, and how many times", () => {
    // A live afternoon produced twenty-five consecutive lines of one person pushing to one
    // branch, minutes apart. That is the feed nobody could read, drawn again.
    const run = Array.from({ length: 6 }, (_nothing, at) =>
      happening("pushed", "flazouh/octo-repo", `2026-07-31T1${at}:00:00Z`, "alex", "widen-the-rail")
    )

    const arranged = activityIn(run)

    expect(arranged[0]?.happenings ?? []).toHaveLength(1)
    expect(arranged[0]?.happenings[0]?.howOften).toBe(6)
  })

  test("keeps pushes to different branches apart, since they are different work", () => {
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "alex", "one"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "alex", "another")
    ])

    expect(arranged[0]?.happenings ?? []).toHaveLength(2)
  })

  test("keeps two people's pushes apart, even to the same branch", () => {
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "alex", "main"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "someone", "main")
    ])

    expect(arranged[0]?.happenings ?? []).toHaveLength(2)
  })

  test("does not fold a run that something else interrupted", () => {
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T13:00:00Z", "alex", "main"),
      happening("opened", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "alex"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "alex", "main")
    ])

    expect((arranged[0]?.happenings ?? []).map((one) => one.kind)).toEqual([
      "pushed",
      "opened",
      "pushed"
    ])
  })

  test("does not merge a star into a push it happens to sit beside", () => {
    const arranged = activityIn([
      happening("starred", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "someone"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "alex"),
      happening("starred", "flazouh/octo-repo", "2026-07-31T10:00:00Z", "another")
    ])

    expect((arranged[0]?.happenings ?? []).map((one) => one.kind)).toEqual(["starred", "pushed", "starred"])
  })
})

describe("how much happened", () => {
  test("counts everything that happened, including the runs that were folded", () => {
    // The count beside Activity answers "how much have I missed", so folding six pushes into
    // one line must not turn six into one.
    const arranged = activityIn([
      happening("pushed", "flazouh/octo-repo", "2026-07-31T12:00:00Z", "alex", "main"),
      happening("pushed", "flazouh/octo-repo", "2026-07-31T11:00:00Z", "alex", "main"),
      happening("opened", "acme/web", "2026-07-31T10:00:00Z")
    ])

    expect(arranged[0]?.happenings.length).toBe(1)
    expect(howMuchHappened(arranged)).toBe(3)
  })

  test("is nothing when nothing happened", () => {
    expect(howMuchHappened(activityIn([]))).toBe(0)
  })
})
