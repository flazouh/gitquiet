import { describe, expect, test } from "bun:test"
import { couldBe, inPackage, reaching, within } from "./reaching"

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

/**
 * Where a file of a package this repository holds might really be.
 *
 * A package's manifest answers about what it *ships*; a repository holds what
 * it *wrote*. The same path in a package with no build step, and a different
 * one in every package with one — measured on a real monorepo, where
 * `@fluentai/shared` says its `./schemas` is `./dist/schemas/index.js` and the
 * file a reader wants is `packages/shared/src/schemas/index.ts`. Following the
 * manifest alone reached one of that repository's seven workspace imports.
 */
describe("a file of a package this repository holds", () => {
  test("offers the package's folder and its source root, in that order", () => {
    expect(inPackage("packages/shared", "schemas", null)).toEqual([
      "packages/shared/schemas",
      "packages/shared/src/schemas"
    ])
  })

  test("reads a built entry as its source, and keeps the built one too", () => {
    // Kept, because a package that really does ship what it wrote is not
    // wrong — it is the one case where the manifest was already the answer.
    expect(inPackage("packages/shared", null, "packages/shared/dist/index.js")).toEqual([
      "packages/shared/dist/index.js",
      "packages/shared/src/index.js"
    ])
  })

  test("leaves an entry that is already source exactly as it is", () => {
    expect(inPackage("packages/player-core", null, "packages/player-core/src/index.ts")).toEqual([
      "packages/player-core/src/index.ts"
    ])
  })

  test("knows the folders a build is written into", () => {
    for (const built of ["dist", "build", "out", "lib", "esm", "cjs"]) {
      expect(inPackage("p", null, `p/${built}/index.js`)).toContain("p/src/index.js")
    }
  })

  test("holds the root package, whose folder is the repository itself", () => {
    expect(inPackage("", "helpers", null)).toEqual(["helpers", "src/helpers"])
  })

  test("has nothing to offer for a package that names no entry", () => {
    expect(inPackage("packages/backend", null, null)).toEqual([])
  })

  /**
   * The whole of it, against the layout the fault was reported from.
   *
   * `.js` means `.ts` here, which is what carries a built entry the rest of the
   * way: the source of `dist/index.js` is `src/index.ts`, and it takes both
   * rules to say so.
   */
  test("finds the source of a built entry, through both rules at once", () => {
    const paths = new Set(["packages/shared/src/index.ts", "packages/shared/src/schemas/index.ts"])
    const found = inPackage("packages/shared", null, "packages/shared/dist/index.js")
      .map((one) => within(one, paths))
      .find((one) => one !== null)
    expect(found).toBe("packages/shared/src/index.ts")

    const deep = inPackage("packages/shared", "schemas", null)
      .map((one) => within(one, paths))
      .find((one) => one !== null)
    expect(deep).toBe("packages/shared/src/schemas/index.ts")
  })
})

describe("a Python module name, as a path", () => {
  const paths = new Set([
    "pkg/__init__.py",
    "pkg/local.py",
    "pkg/deep/__init__.py",
    "pkg/deep/thing.py",
    "other/mod.py",
    "top.py",
    "src/laid/out.py"
  ])

  test("one dot is the package the file is in", () => {
    expect(reaching("pkg/mod.py", ".local", paths)).toBe("pkg/local.py")
  })

  test("a dot and no name is the package's own __init__", () => {
    expect(reaching("pkg/mod.py", ".", paths)).toBe("pkg/__init__.py")
  })

  test("a folder with an __init__ is a module too", () => {
    expect(reaching("pkg/mod.py", ".deep", paths)).toBe("pkg/deep/__init__.py")
  })

  test("dots join with dots, not with slashes", () => {
    expect(reaching("pkg/mod.py", ".deep.thing", paths)).toBe("pkg/deep/thing.py")
  })

  test("two dots climb one package, not one folder", () => {
    expect(reaching("pkg/deep/mod.py", "..local", paths)).toBe("pkg/local.py")
  })

  test("a name with no dot is tried at the root and under src", () => {
    expect(reaching("pkg/mod.py", "top", paths)).toBe("top.py")
    expect(reaching("pkg/mod.py", "laid.out", paths)).toBe("src/laid/out.py")
  })

  test("a module the repository does not hold reaches nothing", () => {
    // `math` is the standard library's, which is not a file here.
    expect(reaching("pkg/mod.py", "math", paths)).toBeNull()
  })

  test("climbing past the top reaches nothing", () => {
    expect(reaching("mod.py", "...local", paths)).toBeNull()
  })
})

describe("a Rust path, as a file", () => {
  const paths = new Set(["src/a/b.rs", "src/only/mod.rs", "src/lib.rs"])

  test("crate:: reads from the crate root", () => {
    expect(reaching("src/main.rs", "crate::a::b", paths)).toBe("src/a/b.rs")
  })

  test("a module written as a folder is found by its mod.rs", () => {
    expect(reaching("src/main.rs", "crate::only", paths)).toBe("src/only/mod.rs")
  })

  test("another crate is outside the repository", () => {
    expect(reaching("src/main.rs", "std::io", paths)).toBeNull()
    expect(reaching("src/main.rs", "serde::Deserialize", paths)).toBeNull()
  })

  test("self and super are not guessed at", () => {
    // Which file a `self::` means depends on the `mod` items a file writes, and
    // guessing between the two it could be is offering a reader a file at random.
    expect(reaching("src/a/b.rs", "self::thing", paths)).toBeNull()
    expect(reaching("src/a/b.rs", "super::thing", paths)).toBeNull()
  })
})
