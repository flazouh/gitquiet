import { describe, expect, test } from "bun:test"
import { hunted } from "./hunting"

const PATHS = [
  "src/config.ts",
  "src/config/loader.ts",
  "src/ui/Files.tsx",
  "docs/spec/CONFIG.md",
  "test/config.test.ts"
]

describe("hunting a path out of every path in a repository", () => {
  test("finds the ones the typing names", () => {
    expect(hunted(PATHS, "loader")).toEqual(["src/config/loader.ts"])
  })

  test("reads the typing however it was cased", () => {
    expect(hunted(PATHS, "CONFIG.TS")).toContain("src/config.ts")
    expect(hunted(PATHS, "config.md")).toContain("docs/spec/CONFIG.md")
  })

  /*
   * The rule that makes it usable. Typing "config" in a repository with a
   * `config` folder matches every file under it, and the file actually called
   * config is the one being looked for.
   */
  test("puts a hit in the file's own name above one only in a folder", () => {
    const found = hunted(PATHS, "config")

    expect(found.indexOf("src/config.ts")).toBeLessThan(found.indexOf("src/config/loader.ts"))
  })

  test("keeps the shorter path first among equals, since it is the likelier one", () => {
    const found = hunted(["a/b/c/thing.ts", "thing.ts"], "thing")

    expect(found[0]).toBe("thing.ts")
  })

  test("takes a folder and a name together, so a path narrows the hunt", () => {
    expect(hunted(PATHS, "spec/config")).toEqual(["docs/spec/CONFIG.md"])
  })

  test("finds nothing for nothing typed, rather than offering every path there is", () => {
    expect(hunted(PATHS, "")).toEqual([])
    expect(hunted(PATHS, "   ")).toEqual([])
  })

  test("stops at the number asked for, since nobody reads the four hundredth", () => {
    const many = Array.from({ length: 400 }, (_unused, at) => `src/thing${at}.ts`)

    expect(hunted(many, "thing", 20)).toHaveLength(20)
  })

  test("answers nothing where nothing matches", () => {
    expect(hunted(PATHS, "zzz")).toEqual([])
  })
})
