import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { partOfFile, wholeFile } from "./wholeFile"

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

/**
 * A run out of the middle of a file, numbered where it came from.
 *
 * The preview beside the uses is seventeen lines of a file drawn by the
 * renderer that drew the file above it — same theme, same font, same colours.
 * A slice handed over as its own file is numbered from one, which would put
 * "1" beside code plainly not at the top of anything.
 */
describe("a part of a file", () => {
  test("numbers its lines from where they start", () => {
    const patch = Option.getOrNull(partOfFile("one.ts", ["const b = 2", "const c = 3"], 120))

    expect(patch).toContain("@@ -120,2 +120,2 @@")
    expect(patch).toContain(" const b = 2")
  })

  test("is the whole file where it starts at the top", () => {
    const part = Option.getOrNull(partOfFile("one.ts", ["a", "b"], 1))

    expect(part).toBe(Option.getOrNull(wholeFile("one.ts", ["a", "b"])))
  })

  test("has nothing to draw for no lines, as the whole of one does", () => {
    expect(Option.isNone(partOfFile("one.ts", [], 40))).toBe(true)
  })
})
