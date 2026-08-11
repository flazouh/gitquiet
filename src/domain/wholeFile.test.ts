import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { wholeFile } from "./wholeFile"

const patch = (lines: ReadonlyArray<string>) =>
  Option.getOrNull(wholeFile("src/ui/Field.tsx", lines))

describe("a whole file, as the patch a renderer reads", () => {
  test("names the file on both sides, because nothing happened to it", () => {
    const written = patch(["const one = 1"])

    expect(written).toContain("--- a/src/ui/Field.tsx")
    expect(written).toContain("+++ b/src/ui/Field.tsx")
  })

  test("counts every line into the hunk, on both sides", () => {
    expect(patch(["a", "b", "c"])).toContain("@@ -1,3 +1,3 @@")
  })

  test("marks every line as context, so nothing reads as added or removed", () => {
    const written = patch(["const one = 1", "const two = 2"]) ?? ""
    const body = written.split("\n").slice(4, 6)

    expect(body).toEqual([" const one = 1", " const two = 2"])
  })

  test("keeps a blank line of the file as a line, not as the end of the patch", () => {
    const written = patch(["a", "", "b"]) ?? ""

    expect(written.split("\n").slice(4, 7)).toEqual([" a", " ", " b"])
  })

  test("gives back nothing for an empty file, which has no patch worth drawing", () => {
    expect(patch([])).toBeNull()
  })
})
