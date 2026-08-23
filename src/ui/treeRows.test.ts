import { describe, expect, test } from "bun:test"
import { changesBetween } from "./treeRows"

describe("keeping the rail's rows in step with the files", () => {
  test("says nothing where the list is the one it drew", () => {
    expect(changesBetween(["a.ts", "b.ts"], ["a.ts", "b.ts"])).toEqual([])
  })

  test("adds the files that arrived and removes the ones that went", () => {
    expect(changesBetween(["a.ts", "b.ts"], ["a.ts", "c.ts"])).toEqual([
      { type: "remove", path: "b.ts" },
      { type: "add", path: "c.ts" }
    ])
  })

  /*
   * The tree has no way to prune a folder its last file left, so a rail with the
   * tests stood aside kept an empty `__tests__` row above nothing.
   */
  test("takes an emptied folder away whole, and its files with it", () => {
    expect(
      changesBetween(["src/checks.ts", "src/__tests__/checks.ts", "src/__tests__/edges.ts"], [
        "src/checks.ts"
      ])
    ).toEqual([{ type: "remove", path: "src/__tests__/", recursive: true }])
  })

  /* Removing the top of an emptied branch removes what is under it, so naming both is an error. */
  test("names only the top of an emptied branch", () => {
    expect(changesBetween(["e2e/api/users/list.ts", "src/checks.ts"], ["src/checks.ts"])).toEqual([
      { type: "remove", path: "e2e/", recursive: true }
    ])
  })

  test("leaves a folder alone while anything is still in it", () => {
    expect(changesBetween(["src/a.ts", "src/b.ts"], ["src/a.ts"])).toEqual([
      { type: "remove", path: "src/b.ts" }
    ])
  })
})
