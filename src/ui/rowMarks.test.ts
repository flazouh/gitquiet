import { describe, expect, it } from "bun:test"
import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { rowMarks, seenFiles, shortCount } from "./rowMarks"

const file = (
  path: string,
  linesAdded: number,
  linesDeleted: number,
  readByViewer = false
): ChangedFile => ({
  path,
  digest: `${path}@1`,
  changeType: "modified",
  linesAdded,
  linesDeleted,
  readByViewer,
  diff: Option.none()
})

const files = [
  file("src/app/one.ts", 10, 2),
  file("src/app/two.ts", 5, 0),
  file("README.md", 1, 1)
]

describe("what a row of the tree says", () => {
  it("gives a file its own two numbers", () => {
    expect(rowMarks(files, new Set()).get("src/app/one.ts")).toEqual({
      added: 10,
      deleted: 2,
      seen: false
    })
  })

  it("gives a directory the sum of everything under it", () => {
    const marks = rowMarks(files, new Set())

    expect(marks.get("src/app")).toMatchObject({ added: 15, deleted: 2 })
    expect(marks.get("src")).toMatchObject({ added: 15, deleted: 2 })
  })

  it("marks a file seen once it has been opened", () => {
    const marks = rowMarks(files, new Set(["README.md"]))
    expect(marks.get("README.md")?.seen).toBe(true)
  })

  it("holds a directory back until all of it has been seen", () => {
    const half = rowMarks(files, new Set(["src/app/one.ts"]))
    expect(half.get("src/app")?.seen).toBe(false)

    const whole = rowMarks(files, new Set(["src/app/one.ts", "src/app/two.ts"]))
    expect(whole.get("src/app")?.seen).toBe(true)
    expect(whole.get("src")?.seen).toBe(true)
  })

  it("says nothing about a path that changed nothing", () => {
    expect(rowMarks(files, new Set()).get("src/nowhere.ts")).toBeUndefined()
  })
})

describe("which files count as read", () => {
  it("starts from the ones GitHub already has ticked", () => {
    const ticked = [file("src/app/one.ts", 1, 0, true), file("README.md", 1, 0)]
    expect([...seenFiles(ticked, new Set())]).toEqual(["src/app/one.ts"])
  })

  it("adds the ones opened since the page loaded", () => {
    const seen = seenFiles(files, new Set(["README.md"]))
    expect(seen.has("README.md")).toBe(true)
  })

  it("counts a file ticked and opened once", () => {
    const ticked = [file("src/app/one.ts", 1, 0, true)]
    expect(seenFiles(ticked, new Set(["src/app/one.ts"])).size).toBe(1)
  })

  it("lets a reader put a file back, against GitHub's own tick", () => {
    // The complaint this answers, in the words it was filed in: "it gets very
    // tedious marking all files as not-viewed". A tick that cannot be undone is
    // a review that cannot be started again.
    const ticked = [file("src/app/one.ts", 1, 0, true)]

    expect(seenFiles(ticked, new Set(), new Set(["src/app/one.ts"])).size).toBe(0)
  })

  it("lets a reader put back a file they opened in this sitting", () => {
    expect(seenFiles(files, new Set(["README.md"]), new Set(["README.md"])).size).toBe(0)
  })

  it("leaves the other files alone when one is put back", () => {
    const some = seenFiles(files, new Set(["README.md", "src/app/one.ts"]), new Set(["README.md"]))

    expect([...some]).toEqual(["src/app/one.ts"])
  })
})

describe("a line count in a narrow rail", () => {
  it("says small numbers as they are", () => {
    expect(shortCount(0)).toBe("0")
    expect(shortCount(999)).toBe("999")
  })

  it("shortens thousands", () => {
    expect(shortCount(1000)).toBe("1k")
    expect(shortCount(1406)).toBe("1.4k")
    expect(shortCount(12500)).toBe("12.5k")
  })
})
