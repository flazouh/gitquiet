import { describe, expect, test } from "bun:test"
import { folderOf, materialIcon, nameOf } from "./fileIcon"

describe("splitting a path where the eye splits it", () => {
  test("keeps the folders together, trailing slash and all", () => {
    expect(folderOf("src/diff/engine.ts")).toBe("src/diff/")
    expect(nameOf("src/diff/engine.ts")).toBe("engine.ts")
  })

  test("gives a file at the root no folders at all", () => {
    expect(folderOf("README.md")).toBe("")
    expect(nameOf("README.md")).toBe("README.md")
  })
})

describe("the icon a file is drawn with", () => {
  test("goes by extension", () => {
    expect(materialIcon("src/diff/engine.ts").name).toBe("mi-typescript")
  })

  test("prefers what the whole name says over what the extension does", () => {
    expect(materialIcon("package.json").name).toBe("mi-nodejs")
    expect(materialIcon("apps/web/package.json").name).toBe("mi-nodejs")
  })

  test("falls back to a plain document rather than nothing", () => {
    expect(materialIcon("scripts/deploy.unheardof").name).toBe("mi-document")
    expect(materialIcon("LICENCE").name).toBe("mi-document")
  })
})
