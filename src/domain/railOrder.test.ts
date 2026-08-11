import { describe, expect, test } from "bun:test"
import { railOrder } from "./railOrder"

describe("the order the rail draws changed files in", () => {
  test("folders come before the files beside them", () => {
    expect(
      railOrder([
        "README.md",
        "package.json",
        "src/usage.test.ts",
        "src/usage.ts",
        ".github/config.yml"
      ])
    ).toEqual([
      ".github/config.yml",
      "src/usage.test.ts",
      "src/usage.ts",
      "package.json",
      "README.md"
    ])
  })

  test("names sort by letter without regard to case", () => {
    expect(railOrder(["b.ts", "A.ts", "a.ts", "B.ts"])).toEqual(["A.ts", "a.ts", "B.ts", "b.ts"])
  })

  test("a number in a name counts as a number", () => {
    expect(railOrder(["step10.ts", "step2.ts", "step1.ts"])).toEqual([
      "step1.ts",
      "step2.ts",
      "step10.ts"
    ])
  })

  test("a deeper folder sorts among the names at its own level", () => {
    expect(
      railOrder(["src/z.ts", "src/nested/a.ts", "src/a.ts", "docs/guide.md"])
    ).toEqual(["docs/guide.md", "src/nested/a.ts", "src/a.ts", "src/z.ts"])
  })

  test("nothing is dropped and nothing is invented", () => {
    const paths = ["one.ts", "two.ts", "three.ts"]
    expect([...railOrder(paths)].sort()).toEqual([...paths].sort())
  })
})
