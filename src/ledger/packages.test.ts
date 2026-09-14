import { describe, expect, test } from "bun:test"
import { entryOf, heldIn, mightBe, nameOf, withinPackage } from "./packages"

/**
 * Which repository a package is, worked out from what repositories say about
 * themselves. Every case here is a shape a real repository is written in.
 */

describe("the packages a repository holds itself", () => {
  const FILES = new Map([
    ["package.json", '{"name":"gitquiet","workspaces":["desktop"],"main":"index.ts"}'],
    ["desktop/package.json", '{"name":"@gitquiet/desktop","types":"./src/main.ts"}'],
    ["packages/ui/package.json", '{"name":"@gitquiet/ui","exports":{".":{"types":"./index.d.ts"}}}'],
    ["node_modules/left-pad/package.json", '{"name":"left-pad"}'],
    ["docs/package.json", "{ not json at all"]
  ])

  test("knows each one by the name other files import it as", () => {
    const held = heldIn(FILES)

    expect(held.get("@gitquiet/desktop")?.at).toBe("desktop")
    expect(held.get("@gitquiet/ui")?.at).toBe("packages/ui")
    expect(held.get("gitquiet")?.at).toBe("")
  })

  test("resolves each one to the file its name means", () => {
    const held = heldIn(FILES)

    expect(held.get("@gitquiet/desktop")?.entry).toBe("desktop/src/main.ts")
    expect(held.get("@gitquiet/ui")?.entry).toBe("packages/ui/index.d.ts")
    expect(held.get("gitquiet")?.entry).toBe("index.ts")
  })

  test("leaves out a vendored copy, which is not a package this repository holds", () => {
    expect(heldIn(FILES).has("left-pad")).toBe(false)
  })

  test("passes over a package.json somebody is in the middle of editing", () => {
    // Which a pull request is full of, and which must not take the rest with it.
    expect(heldIn(FILES).size).toBe(3)
  })
})

describe("what a package.json says", () => {
  test("prefers the source a reader can read to the bundle a build wrote", () => {
    expect(entryOf('{"types":"./src/one.ts","main":"./dist/one.js"}')).toBe("./src/one.ts")
  })

  test("reads the simple shape of exports and no cleverer one", () => {
    expect(entryOf('{"exports":{".":"./index.ts"}}')).toBe("./index.ts")
    expect(entryOf('{"exports":{".":{"types":"./index.d.ts","import":"./index.js"}}}')).toBe(
      "./index.d.ts"
    )
    // Conditions this cannot evaluate. A guess between them is a Follow into
    // whichever branch happened to be written first.
    expect(entryOf('{"exports":{"./deep":"./deep.ts"}}')).toBeNull()
  })

  test("answers nothing for a file that is not a package", () => {
    expect(nameOf("nonsense")).toBeNull()
    expect(entryOf("nonsense")).toBeNull()
  })
})

describe("which repositories a bare specifier might be", () => {
  const from = { owner: "flowline-labs", repo: "flowline" }

  test("takes a scope for an owner, which it usually is", () => {
    expect(mightBe("@yourorg/thing", from)[0]).toEqual({ owner: "yourorg", repo: "thing" })
  })

  test("offers the one-repository-per-scope shape as well", () => {
    // `@effect/platform` lives in `effect/effect`, and so do most scopes that
    // publish more than a handful of packages.
    expect(mightBe("@effect/platform", from)[1]).toEqual({ owner: "effect", repo: "effect" })
  })

  test("takes an unscoped name for this owner's own", () => {
    expect(mightBe("flowline-shared", from)).toEqual([
      { owner: "flowline-labs", repo: "flowline-shared" }
    ])
  })

  test("says nothing about a path, which is not a package at all", () => {
    expect(mightBe("./elsewhere", from)).toEqual([])
    expect(mightBe("/etc/passwd", from)).toEqual([])
  })

  test("reads a deep import as its package and the rest of the path", () => {
    expect(mightBe("@yourorg/thing/helpers", from)[0]).toEqual({
      owner: "yourorg",
      repo: "thing"
    })
    expect(withinPackage("@yourorg/thing/helpers")).toBe("helpers")
    expect(withinPackage("@yourorg/thing")).toBeNull()
    expect(withinPackage("thing/deep/er")).toBe("deep/er")
  })
})
