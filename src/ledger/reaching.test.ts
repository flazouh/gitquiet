import { describe, expect, test } from "bun:test"
import { couldBe, inPackage, knowGoModules, reaching, reachingAll, within } from "./reaching"
import { goModuleOf, goModulesIn } from "./goModules"

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
    expect(couldBe("src/ui/RepoTree.tsx", "react", PATHS)).toEqual([])
  })

  test("answers nothing for a file the repository does not have", () => {
    expect(reaching("src/ui/RepoTree.tsx", "./missing", PATHS)).toBeNull()
  })

  test("does not climb out of the repository", () => {
    expect(couldBe("src/one.ts", "../../../../etc/passwd", PATHS)).toEqual([])
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

describe("what a Ruby require_relative names", () => {
  const paths = new Set(["app/main.rb", "app/local/helper.rb", "app/sibling.rb", "lib/thing.rb"])

  test("names a file beside the one that wrote it", () => {
    expect(reaching("app/main.rb", "sibling", paths)).toBe("app/sibling.rb")
  })

  test("takes a path under that folder", () => {
    expect(reaching("app/main.rb", "local/helper", paths)).toBe("app/local/helper.rb")
  })

  test("climbs with dots, as a path does", () => {
    expect(reaching("app/local/helper.rb", "../sibling", paths)).toBe("app/sibling.rb")
  })

  test("a gem is not a file in this repository", () => {
    // `require 'set'` never reaches here — ruby.ts records only the relative
    // one — and a name that happens to look like a path still has to exist.
    expect(reaching("app/main.rb", "set", paths)).toBeNull()
  })
})

describe("what a quoted C++ include names", () => {
  const paths = new Set([
    "src/main.cpp",
    "src/local/helper.h",
    "include/shared/thing.h",
    "lib/vendor.h"
  ])

  test("names a header beside the file that included it", () => {
    expect(reaching("src/main.cpp", "local/helper.h", paths)).toBe("src/local/helper.h")
  })

  test("falls back to where a repository keeps headers", () => {
    expect(reaching("src/main.cpp", "shared/thing.h", paths)).toBe("include/shared/thing.h")
  })

  test("keeps the ending, which C++ writes and the others leave off", () => {
    expect(reaching("src/main.cpp", "vendor.h", paths)).toBe("lib/vendor.h")
  })

  test("a header this repository does not hold reaches nothing", () => {
    expect(reaching("src/main.cpp", "vector", paths)).toBeNull()
  })
})

/**
 * A press, said the way production says it.
 *
 * `java.ts`, `php.ts` and `csharp.ts` record an import as the name it brought
 * and the package it came from — `Box` from `com.ex.shapes` — because that is
 * what reads well on a card. Both halves are then needed to build a path, and
 * every caller passes both. A test that passed only the specifier was testing a
 * call that never happens, which is how a bug in putting the two back together
 * lived through a green suite.
 */
const pressed = (
  from: string,
  whole: string,
  paths: ReadonlySet<string>,
  separator = "."
): string | null => {
  const at = whole.lastIndexOf(separator)
  const name = at === -1 ? whole : whole.slice(at + separator.length)
  const specifier = at === -1 ? "" : whole.slice(0, at)
  return reachingAll(from, specifier, paths, name)[0] ?? null
}

describe("what a Java import names", () => {
  const paths = new Set([
    "src/main/java/com/example/app/Box.java",
    "src/main/java/com/example/app/Main.java",
    "core/src/main/java/com/example/core/Engine.java",
    "flat/com/example/Plain.java"
  ])

  test("a package is a folder and a type is a file", () => {
    expect(
      pressed("src/main/java/com/example/app/Main.java", "com.example.app.Box", paths)
    ).toBe("src/main/java/com/example/app/Box.java")
  })

  test("finds a type in another module of the same build", () => {
    expect(
      pressed("src/main/java/com/example/app/Main.java", "com.example.core.Engine", paths)
    ).toBe("core/src/main/java/com/example/core/Engine.java")
  })

  test("the standard library is not in this repository", () => {
    expect(pressed("src/main/java/com/example/app/Main.java", "java.util.List", paths)).toBeNull()
  })
})

describe("what a PHP use names", () => {
  const paths = new Set(["src/Other/Thing.php", "src/App/Legacy/Old.php", "lib/Deep/Down.php"])

  test("PSR-4 maps the namespace prefix onto a source root", () => {
    // `App\` is mapped to `src/`, so `App\Other\Thing` is `src/Other/Thing.php`.
    expect(pressed("src/Main.php", "App\\Other\\Thing", paths, "\\")).toBe("src/Other/Thing.php")
  })

  test("a repository that keeps the prefix as a folder answers too", () => {
    expect(pressed("src/Main.php", "App\\Legacy\\Old", paths, "\\")).toBe("src/App/Legacy/Old.php")
  })

  test("a namespace this repository does not hold reaches nothing", () => {
    expect(pressed("src/Main.php", "Vendor\\Package\\Thing", paths, "\\")).toBeNull()
  })
})

describe("what a Go import names, which is a folder", () => {
  const paths = new Set([
    "main.go",
    "shapes/box.go",
    "shapes/circle.go",
    "shapes/box_test.go",
    "shapes/inner/deep.go",
    "vendor/other/thing.go"
  ])

  test("every file of the package, because the import does not say which", () => {
    // A Go package is a directory, and which of its files writes the name asked
    // about is not something the import path says.
    expect(reachingAll("main.go", "example.com/app/shapes", paths)).toEqual([
      "shapes/box.go",
      "shapes/circle.go"
    ])
  })

  test("takes the longest tail of the path that is really a folder here", () => {
    // `go.mod` is not read, so the module's own prefix is found by checking.
    expect(reachingAll("main.go", "shapes", paths)).toEqual(["shapes/box.go", "shapes/circle.go"])
  })

  test("leaves out a test file, which exercises a name rather than writing it", () => {
    expect(reachingAll("main.go", "shapes", paths)).not.toContain("shapes/box_test.go")
  })

  test("does not reach into a folder below the package, since a package does not nest", () => {
    expect(reachingAll("main.go", "shapes", paths)).not.toContain("shapes/inner/deep.go")
  })

  test("a package this repository does not hold reaches nothing", () => {
    expect(reachingAll("main.go", "github.com/pkg/errors", paths)).toEqual([])
  })

  test("a package of somebody else's repository is not a folder of this one that ends the same", () => {
    // `github.com/owner/repo` is a module, so what follows it is the only part
    // that can be a folder here. `shapes` alone is somebody else's `shapes`.
    expect(reachingAll("main.go", "github.com/other/lib/shapes", paths)).toEqual([
      "shapes/box.go",
      "shapes/circle.go"
    ])
    expect(reachingAll("main.go", "github.com/other/shapes", paths)).toEqual([])
  })

  test("the standard library is never a folder of this repository", () => {
    // `net/http` is Go's own. A top-level `http/` here is somebody's wrapper.
    expect(reachingAll("main.go", "net/shapes", paths)).toEqual([])
  })
})

describe("a namespace whose last part is the type's own name", () => {
  const paths = new Set(["src/Thing/Thing.php", "src/Solo.php", "App/Deep/Deep.java"])

  test("PHP keeps both, rather than taking one for the other", () => {
    // `App\\Thing\\Thing` is an ordinary PSR-4 class. A guard that skipped
    // putting the name back when the specifier already ended in it resolved
    // this to `src/Thing.php`, which is a different file.
    expect(pressed("src/Main.php", "App\\Thing\\Thing", paths, "\\")).toBe("src/Thing/Thing.php")
  })

  test("a use with no namespace at all still names a file", () => {
    // `use Solo;` came from nowhere this can name. Answering "Solo" as the
    // namespace made the name arrive twice and matched nothing.
    expect(pressed("src/Main.php", "Solo", paths, "\\")).toBe("src/Solo.php")
  })

  test("Java keeps both too", () => {
    expect(pressed("src/Main.java", "App.Deep.Deep", paths)).toBe("App/Deep/Deep.java")
  })
})

describe("what a C# alias names", () => {
  const paths = new Set(["src/Other/Thing.cs", "App/Legacy/Old.cs", "src/App/Deep/Down.cs"])

  test("a namespace laid out as folders under a source root", () => {
    expect(pressed("src/Main.cs", "App.Other.Thing", paths)).toBe("src/Other/Thing.cs")
  })

  test("a repository that keeps the whole namespace as folders", () => {
    expect(pressed("src/Main.cs", "App.Legacy.Old", paths)).toBe("App/Legacy/Old.cs")
  })

  test("and one that keeps it under src", () => {
    expect(pressed("src/Main.cs", "App.Deep.Down", paths)).toBe("src/App/Deep/Down.cs")
  })

  test("a namespace this repository does not hold reaches nothing", () => {
    // A namespace in C# is not a folder, so this is convention and nothing more.
    // What is not held is not guessed at.
    expect(pressed("src/Main.cs", "System.Text.Json", paths)).toBeNull()
  })
})

/*
 * Without `go.mod`, which part of an import path is the module is a guess, and
 * three layouts defeated it: a package at the root of the repository, a module
 * kept in a folder, and a host that says nothing about its length.
 */
describe("a Go import, read against the modules go.mod declares", () => {
  test("a package at the root of the repository is the root", () => {
    const paths = new Set(["go.mod", "command.go", "args.go", "command_test.go", "doc/md_docs.go"])
    knowGoModules(paths, new Map([["github.com/spf13/cobra", ""]]))

    expect(reachingAll("doc/md_docs.go", "github.com/spf13/cobra", paths)).toEqual([
      "args.go",
      "command.go"
    ])
    expect(reachingAll("command.go", "github.com/spf13/cobra/doc", paths)).toEqual(["doc/md_docs.go"])
  })

  test("a module kept in a folder is read from that folder", () => {
    const paths = new Set(["server/go.mod", "server/shapes/box.go", "shapes/other.go"])
    knowGoModules(paths, new Map([["github.com/x/y", "server"]]))

    expect(reachingAll("server/main.go", "github.com/x/y/shapes", paths)).toEqual(["server/shapes/box.go"])
  })

  test("an import of no module here is somebody else's, however its folders end", () => {
    const paths = new Set(["go.mod", "grpc/server.go", "http/client.go"])
    knowGoModules(paths, new Map([["github.com/me/app", ""]]))

    expect(reachingAll("main.go", "google.golang.org/grpc", paths)).toEqual([])
    expect(reachingAll("main.go", "net/http", paths)).toEqual([])
    expect(reachingAll("main.go", "github.com/me/app/grpc", paths)).toEqual(["grpc/server.go"])
  })

  test("the module nearest the package wins, where one module is inside another", () => {
    const paths = new Set(["go.mod", "api/go.mod", "api/v1/types.go", "v1/other.go"])
    knowGoModules(paths, new Map([["github.com/x/y", ""], ["github.com/x/y/api", "api"]]))

    expect(reachingAll("main.go", "github.com/x/y/api/v1", paths)).toEqual(["api/v1/types.go"])
  })

  test("a repository whose go.mod files were not all read still guesses for the rest", () => {
    // A press reads twenty at most, and a read can fail. What was not read may
    // hold the import, so nothing matching is not the same as nothing here.
    const paths = new Set(["go.mod", "api/go.mod", "shapes/box.go"])
    knowGoModules(paths, new Map([["github.com/x/y/api", "api"]]), false)

    expect(reachingAll("main.go", "github.com/x/y/shapes", paths)).toEqual(["shapes/box.go"])
  })

  test("a repository whose go.mod files said nothing is guessed at as before", () => {
    const paths = new Set(["shapes/box.go"])
    knowGoModules(paths, new Map())

    expect(reachingAll("main.go", "example.com/app/shapes", paths)).toEqual(["shapes/box.go"])
  })
})

describe("what a go.mod says its module is", () => {
  test("reads the module line, quoted or not, past comments", () => {
    expect(goModuleOf("// the app\nmodule github.com/x/y\n\ngo 1.22\n")).toBe("github.com/x/y")
    expect(goModuleOf('module "github.com/x/y" // quoted\n')).toBe("github.com/x/y")
    expect(goModuleOf("go 1.22\n")).toBeNull()
    expect(goModuleOf("module (\n\tgithub.com/x/y\n)\n")).toBeNull()
  })

  test("finds every module in a repository, by the folder its go.mod is in", () => {
    const files = new Map([
      ["go.mod", "module github.com/x/y\n"],
      ["api/go.mod", "module github.com/x/y/api\n"],
      ["vendor/github.com/z/go.mod", "module github.com/z\n"],
      ["README.md", "module nothing\n"]
    ])

    expect([...goModulesIn(files)]).toEqual([
      ["github.com/x/y", ""],
      ["github.com/x/y/api", "api"]
    ])
  })
})
