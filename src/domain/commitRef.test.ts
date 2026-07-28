import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { fromPathname, toUrl } from "./CommitRef"

const parsed = (path: string) => Option.getOrNull(fromPathname(path))

describe("the address of one commit", () => {
  test("reads the owner, the repository and the commit out of it", () => {
    expect(parsed("/flazouh/githubpro/commit/9f0c4c6f48503a651d4582a767e5f06e83300931")).toEqual({
      owner: "flazouh",
      repo: "githubpro",
      sha: "9f0c4c6f48503a651d4582a767e5f06e83300931"
    })
  })

  test("reads an abbreviated one, which is what their own links carry", () => {
    expect(parsed("/flazouh/githubpro/commit/9f0c4c6")?.sha).toBe("9f0c4c6")
  })

  test("does not mind a trailing slash", () => {
    expect(parsed("/flazouh/githubpro/commit/9f0c4c6/")?.sha).toBe("9f0c4c6")
  })

  test("is not the list of commits, which is a page about many of them", () => {
    expect(parsed("/flazouh/githubpro/commits/main")).toBeNull()
  })

  test("is not a commit read inside a pull request, which that page already owns", () => {
    expect(parsed("/flazouh/githubpro/pull/12/commits/9f0c4c6")).toBeNull()
  })

  test("is not a branch name standing where a commit should be", () => {
    // GitHub resolves `/commit/main` too, but nothing links to it that way and
    // a branch is not a thing this can be asked to read twice and get the same
    // answer. Only what a commit is actually named.
    expect(parsed("/flazouh/githubpro/commit/main")).toBeNull()
  })

  test("is not the patch or the diff of one, which are files rather than pages", () => {
    expect(parsed("/flazouh/githubpro/commit/9f0c4c6.patch")).toBeNull()
    expect(parsed("/flazouh/githubpro/commit/9f0c4c6.diff")).toBeNull()
  })

  test("says where it is, for the header that links back to GitHub's own page", () => {
    expect(toUrl({ owner: "flazouh", repo: "githubpro", sha: "9f0c4c6" })).toBe(
      "https://github.com/flazouh/githubpro/commit/9f0c4c6"
    )
  })
})
