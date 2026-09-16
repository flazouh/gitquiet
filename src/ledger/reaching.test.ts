import { describe, expect, test } from "bun:test"
import { couldBe, reaching, within } from "./reaching"

/** A repository laid out the way most of them are. */
const PATHS = new Set([
  "src/ui/place.ts",
  "src/ui/Files.tsx",
  "src/ui/parts/index.ts",
  "src/domain/repoHome.ts",
  "src/legacy/old.js",
  "README.md"
])

describe("which file a specifier names", () => {
  test("follows a sibling", () => {
    expect(reaching("src/ui/RepoTree.tsx", "./place", PATHS)).toBe("src/ui/place.ts")
  })

  test("follows a folder up", () => {
    expect(reaching("src/ui/RepoTree.tsx", "../domain/repoHome", PATHS)).toBe(
      "src/domain/repoHome.ts"
    )
  })

  test("takes a folder to mean the index inside it", () => {
    expect(reaching("src/ui/RepoTree.tsx", "./parts", PATHS)).toBe("src/ui/parts/index.ts")
  })

  test("reads a `.js` specifier as the TypeScript beside it, which is how modules are written", () => {
    expect(reaching("src/ui/RepoTree.tsx", "./place.js", PATHS)).toBe("src/ui/place.ts")
  })

  test("falls back to the JavaScript where there is no TypeScript", () => {
    expect(reaching("src/ui/RepoTree.tsx", "../legacy/old.js", PATHS)).toBe("src/legacy/old.js")
  })

  test("leaves the repository alone for a dependency", () => {
    expect(reaching("src/ui/RepoTree.tsx", "effect", PATHS)).toBeNull()
    expect(reaching("src/ui/RepoTree.tsx", "@effect/platform", PATHS)).toBeNull()
    expect(couldBe("src/ui/RepoTree.tsx", "react")).toEqual([])
  })

  test("answers nothing for a file the repository does not have", () => {
    expect(reaching("src/ui/RepoTree.tsx", "./missing", PATHS)).toBeNull()
  })

  test("does not climb out of the repository", () => {
    expect(couldBe("src/one.ts", "../../../../etc/passwd")).toEqual([])
    expect(reaching("src/one.ts", "../..", PATHS)).toBeNull()
  })

  test("prefers the source to the thing built from it", () => {
    const both = new Set(["src/one.ts", "src/one.js"])
    expect(reaching("src/two.ts", "./one", both)).toBe("src/one.ts")
  })
})

/**
 * A path arrived at through a package's own folder, rather than through a
 * specifier relative to a file.
 *
 * `@org/type-utils` held at `packages/type-utils` and imported as
 * `@org/type-utils/result-monad` means `packages/type-utils/result-monad` — a
 * path with no ending on it and nothing of that name on disk. It was handed on
 * as written, so it matched no file, and the answer fell through to the first
 * Writing of that name anywhere in the repository. A reader pressing
 * `AsyncResult` was shown a different thing with the same spelling and told it
 * was the place.
 */
describe("a path inside the repository", () => {
  const paths = new Set([
    "packages/type-utils/result-monad.ts",
    "packages/helpers/read-body-within-limit.ts",
    "services/api/src/index.tsx",
    "packages/deep/nested/index.ts"
  ])

  test("finds the file a folder and a name really mean", () => {
    expect(within("packages/type-utils/result-monad", paths)).toBe(
      "packages/type-utils/result-monad.ts"
    )
  })

  test("finds a folder's own index, which is how a package names itself", () => {
    expect(within("packages/deep/nested", paths)).toBe("packages/deep/nested/index.ts")
  })

  test("takes a path that already names its ending as written", () => {
    expect(within("services/api/src/index.tsx", paths)).toBe("services/api/src/index.tsx")
  })

  test("answers nothing where the repository holds no such file", () => {
    // A path built from a package's layout is a claim about the repository, and
    // it is checked like every other claim here rather than believed.
    expect(within("packages/type-utils/nowhere", paths)).toBeNull()
    expect(within("", paths)).toBeNull()
  })

  test("says `a/b/../c` plainly, and refuses a climb out of the repository", () => {
    expect(within("packages/helpers/../type-utils/result-monad", paths)).toBe(
      "packages/type-utils/result-monad.ts"
    )
    expect(within("../../etc/passwd", paths)).toBeNull()
  })
})
