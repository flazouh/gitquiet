import { describe, expect, test } from "bun:test"
import { issueEntitled, pullRequestEntitled, repoEntitled, titleAt } from "./entitling"

describe("the title an address earns the moment it is the page", () => {
  test("a repository's front page is its name", () => {
    expect(titleAt("repo-home", "/flazouh/gitquiet")).toBe("flazouh/gitquiet")
  })

  test("a file keeps its own name in front of the repository's", () => {
    expect(titleAt("repo-home", "/flazouh/gitquiet/blob/main/src/ui/going.ts")).toBe(
      "going.ts · flazouh/gitquiet"
    )
  })

  test("a branch's tree is still the repository", () => {
    expect(titleAt("repo-home", "/flazouh/gitquiet/tree/quiet-corners")).toBe(
      "flazouh/gitquiet"
    )
  })

  test("a pull request says its number before its words are known", () => {
    expect(titleAt("pull-request", "/oven-sh/bun/pull/1934")).toBe(
      "Pull Request #1934 · oven-sh/bun"
    )
  })

  test("an issue does the same", () => {
    expect(titleAt("issue", "/oven-sh/bun/issues/77")).toBe("Issue #77 · oven-sh/bun")
  })

  test("a commit is named by the seven characters a reader recognises", () => {
    expect(
      titleAt("commit", "/oven-sh/bun/commit/b35713c4b5aa922fef5442d002d43c72b7d13838")
    ).toBe("Commit b35713c · oven-sh/bun")
  })

  test("each repository tab wears the tab's own word", () => {
    expect(titleAt("repo-pulls", "/oven-sh/bun/pulls")).toBe("Pull requests · oven-sh/bun")
    expect(titleAt("repo-issues", "/oven-sh/bun/issues")).toBe("Issues · oven-sh/bun")
    expect(titleAt("commits", "/oven-sh/bun/commits/main")).toBe("Commits · oven-sh/bun")
    expect(titleAt("actions", "/oven-sh/bun/actions")).toBe("Actions · oven-sh/bun")
    expect(titleAt("releases", "/oven-sh/bun/releases")).toBe("Releases · oven-sh/bun")
    expect(titleAt("raise", "/oven-sh/bun/issues/new")).toBe("New issue · oven-sh/bun")
  })

  test("a workflow run is named by its id", () => {
    expect(titleAt("run", "/oven-sh/bun/actions/runs/30866145080")).toBe(
      "Run 30866145080 · oven-sh/bun"
    )
  })

  test("the pages that are the reader's own need no repository", () => {
    expect(titleAt("working-set", "/pulls")).toBe("Pull requests")
    expect(titleAt("working-set", "/")).toBe("GitHub")
    expect(titleAt("issues", "/issues")).toBe("Issues")
    expect(titleAt("notifications", "/notifications")).toBe("Notifications")
  })

  test("a person's pages are their login", () => {
    expect(titleAt("profile", "/flazouh")).toBe("flazouh")
    expect(titleAt("person-repos", "/flazouh")).toBe("Repositories · flazouh")
  })

  test("says nothing for a wall, whose page is not the address's", () => {
    expect(titleAt("sign-on", "/oven-sh/bun/pull/1934")).toBeNull()
  })

  test("says nothing rather than a wrong name for an address missing its parts", () => {
    expect(titleAt("repo-home", "/")).toBeNull()
    expect(titleAt("pull-request", "/oven-sh")).toBeNull()
  })
})

describe("the fuller titles a screen says once it has read", () => {
  test("a repository adds its description, the way GitHub's own page says it", () => {
    expect(
      repoEntitled({ owner: "flazouh", repo: "gitquiet" }, "A quieter GitHub")
    ).toBe("flazouh/gitquiet: A quieter GitHub")
  })

  test("and stays the bare name where there is none", () => {
    expect(repoEntitled({ owner: "flazouh", repo: "gitquiet" }, null)).toBe(
      "flazouh/gitquiet"
    )
  })

  test("a pull request leads with its words", () => {
    expect(
      pullRequestEntitled(
        { owner: "oven-sh", repo: "bun", number: 1934 },
        "canonical component library"
      )
    ).toBe("canonical component library · Pull Request #1934 · oven-sh/bun")
  })

  test("an issue leads with its words too", () => {
    expect(
      issueEntitled({ owner: "oven-sh", repo: "bun", number: 77 }, "it broke")
    ).toBe("it broke · Issue #77 · oven-sh/bun")
  })
})
