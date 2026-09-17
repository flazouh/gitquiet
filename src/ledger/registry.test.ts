import { describe, expect, test } from "bun:test"
import { asking, publishedAt } from "./registry"

/**
 * What a published package says about where it was written.
 *
 * Every shape here was counted in one `node_modules` before it was written
 * down: 488 manifests carrying a `repository` field, and all 488 answered by
 * the rules below. The forms are not a guess about what npm allows — they are
 * what packages actually use, in the proportions they use them.
 */
const manifest = (repository: unknown): string => JSON.stringify({ name: "x", repository })

describe("where a published package was written", () => {
  test("reads an object with a plain https url, the commonest form", () => {
    expect(publishedAt(manifest({ type: "git", url: "https://github.com/motdotla/dotenv-expand" })))
      .toEqual({ repo: { owner: "motdotla", repo: "dotenv-expand" } })
  })

  test("reads `git+https` and takes the `.git` off", () => {
    expect(publishedAt(manifest({ type: "git", url: "git+https://github.com/sindresorhus/ky.git" })))
      .toEqual({ repo: { owner: "sindresorhus", repo: "ky" } })
  })

  test.each([
    ["git://", "git://github.com/one/two.git"],
    ["http://", "http://github.com/one/two"],
    ["git@", "git@github.com:one/two.git"],
    ["git+ssh", "git+ssh://git@github.com/one/two.git"]
  ])("reads a %s url", (_what, url) => {
    expect(publishedAt(manifest({ url }))?.repo).toEqual({ owner: "one", repo: "two" })
  })

  test("reads a bare string, which is a url or npm's own shorthand", () => {
    expect(publishedAt(manifest("https://github.com/one/two"))?.repo).toEqual({
      owner: "one",
      repo: "two"
    })
    expect(publishedAt(manifest("lukeed/clsx"))?.repo).toEqual({ owner: "lukeed", repo: "clsx" })
    expect(publishedAt(manifest("github:one/two"))?.repo).toEqual({ owner: "one", repo: "two" })
  })

  /**
   * The field this is worth having for.
   *
   * `scheduler` is written in `facebook/react`, in `packages/scheduler`. A
   * Follow that landed on the root of `react` would be a Follow to the wrong
   * place in the right repository, which is the kind of answer that is worse
   * than none.
   */
  test("carries the folder a package sits in, where its repository holds many", () => {
    expect(
      publishedAt(
        manifest({
          type: "git",
          url: "git+https://github.com/facebook/react.git",
          directory: "packages/scheduler"
        })
      )
    ).toEqual({
      repo: { owner: "facebook", repo: "react" },
      directory: "packages/scheduler"
    })
  })

  test("says that folder plainly, however it was written", () => {
    for (const written of ["./packages/x", "/packages/x", "packages/x/"]) {
      expect(publishedAt(manifest({ url: "https://github.com/a/b", directory: written }))?.directory)
        .toBe("packages/x")
    }
  })

  test("answers nothing for a repository this cannot draw", () => {
    // GitLab is somewhere else, and somewhere else is where it stays. A reader
    // gets what they had before rather than a page that will not open.
    expect(publishedAt(manifest({ url: "https://gitlab.com/one/two.git" }))).toBeNull()
    expect(publishedAt(manifest({ url: "https://bitbucket.org/one/two" }))).toBeNull()
    expect(publishedAt(manifest("gitlab:one/two"))).toBeNull()
  })

  test("answers nothing where there is nothing to read", () => {
    // A manifest that does not parse is the ordinary case, not the exceptional
    // one, and nothing here throws because somebody published something odd.
    expect(publishedAt("not json at all")).toBeNull()
    expect(publishedAt("null")).toBeNull()
    expect(publishedAt(JSON.stringify({ name: "x" }))).toBeNull()
    expect(publishedAt(manifest({ type: "git" }))).toBeNull()
    expect(publishedAt(manifest(42))).toBeNull()
  })

  test("asks one address, and names the package in it", () => {
    // The version rather than the whole packument: a popular package's full
    // document is every version it ever had, and the question is one field.
    expect(asking("zod")).toBe("https://registry.npmjs.org/zod/latest")
    expect(asking("@effect/platform")).toBe(
      "https://registry.npmjs.org/%40effect/platform/latest"
    )
  })
})
