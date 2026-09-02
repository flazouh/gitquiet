import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { aComment, aThread, anchoredAt, person } from "../../tests/snapshots"
import type { ReviewThread, ThreadAnchor } from "../domain/PullRequest"
import type { DiffLine } from "../domain/PullRequest"
import { type Drawn, drawnIn, threadKey, threadNotes, threadsOn } from "./threads"

const at = (
  path: string,
  line: number,
  side: NonNullable<ThreadAnchor["lines"]>["side"] = "after",
  startLine = line
): Option.Option<ThreadAnchor> => Option.some({ path, lines: { side, line, startLine } })

/** A thread about the file as a whole: a path, and no line anywhere. */
const aboutTheFile = (id: string, path: string): ReviewThread =>
  aThread(id, [aComment(person("ana"), `about ${path}`)], false, Option.some({ path, lines: null }))

const onLine = (id: string, path: string, line: number): ReviewThread =>
  aThread(id, [aComment(person("ana"), `about ${path}:${line}`)], false, anchoredAt(path, line))

/** A diff that drew these lines on each side, however it drew them. */
const drew = (before: ReadonlyArray<number>, after: ReadonlyArray<number>): Drawn => ({
  before: new Set(before),
  after: new Set(after)
})

/** Every line of a file drawn, which is the case nothing is out of reach in. */
const ALL = drew([...Array(400).keys()], [...Array(400).keys()])

const reached = (
  threads: ReadonlyArray<ReviewThread>,
  path: string,
  drawn: Drawn | null = ALL
) => threadsOn(threads, path, drawn)

describe("putting a review thread back on its line", () => {
  test("keeps only the threads belonging to the file being read", () => {
    const found = reached(
      [onLine("t1", "src/spin.ts", 12), onLine("t2", "README.md", 3)],
      "src/spin.ts"
    )

    expect(found.inReach.map((one) => one.thread.id)).toEqual(["t1"])
  })

  test("leaves out a thread about the pull request rather than about a line", () => {
    const loose = aThread("t9", [aComment(person("ana"), "looks good overall")])

    const found = reached([loose], "src/spin.ts")

    expect(found.inReach).toEqual([])
    expect(found.outOfReach).toEqual([])
  })

  test("hangs the row off the line GitHub keyed the marker by", () => {
    const spanning = aThread(
      "t3",
      [aComment(person("ana"), "this whole block")],
      false,
      at("src/spin.ts", 140, "after", 137)
    )

    // The last line of the range, which is where GitHub draws it too — a row
    // opened at 137 would sit above the code the remark is about.
    expect(threadNotes(reached([spanning], "src/spin.ts").inReach)).toEqual([
      { key: "thread:t3", side: "additions", line: 140 }
    ])
  })

  test("puts a remark on a removed line against the old file's numbering", () => {
    const gone = aThread(
      "t4",
      [aComment(person("ana"), "why was this dropped")],
      false,
      at("src/spin.ts", 27, "before")
    )

    expect(threadNotes(reached([gone], "src/spin.ts").inReach)).toEqual([
      { key: "thread:t4", side: "deletions", line: 27 }
    ])
  })

  test("names a row after the thread, so it survives the file being redrawn", () => {
    expect(threadKey(onLine("t5", "src/spin.ts", 9))).toBe("thread:t5")
  })
})

const line = (before: number | null, after: number | null): DiffLine => ({
  kind: before === null ? "added" : after === null ? "deleted" : "context",
  text: "",
  beforeLine: Option.fromNullishOr(before),
  afterLine: Option.fromNullishOr(after)
})

describe("a remark on a line the diff never drew", () => {
  test("reads which lines a diff holds off its own two numberings", () => {
    const drawn = drawnIn([line(11, 11), line(12, null), line(null, 12), line(13, 13)])

    expect([...drawn.before].sort((a, b) => a - b)).toEqual([11, 12, 13])
    expect([...drawn.after].sort((a, b) => a - b)).toEqual([11, 12, 13])
  })

  test("puts a thread on a line outside the hunks out of reach", () => {
    const far = onLine("t4", "src/spin.ts", 150)

    const found = reached([far], "src/spin.ts", drew([], [1, 2, 3, 40]))

    expect(found.inReach).toEqual([])
    expect(found.outOfReach.map((one) => one.thread.id)).toEqual(["t4"])
  })

  test("hands the renderer no row for one, since there is no line to hang it on", () => {
    const far = onLine("t4", "src/spin.ts", 150)

    expect(threadNotes(reached([far], "src/spin.ts", drew([], [40])).inReach)).toEqual([])
  })

  test("judges a remark on a removed line against the old file's numbering", () => {
    const removed = aThread(
      "t5",
      [aComment(person("ana"), "this went")],
      false,
      at("src/spin.ts", 12, "before")
    )

    expect(reached([removed], "src/spin.ts", drew([12], [])).inReach.length).toBe(1)
    expect(reached([removed], "src/spin.ts", drew([], [12])).outOfReach.length).toBe(1)
  })

  test("asks about the last line of a range, which is where the row hangs", () => {
    const spanning = aThread(
      "t6",
      [aComment(person("ana"), "this whole block")],
      false,
      at("src/spin.ts", 140, "after", 137)
    )

    expect(reached([spanning], "src/spin.ts", drew([], [137])).outOfReach.length).toBe(1)
    expect(reached([spanning], "src/spin.ts", drew([], [140])).inReach.length).toBe(1)
  })

  test("keeps a thread about the whole file out of both, since it never had a line", () => {
    const whole = aboutTheFile("t8", "src/spin.ts")

    const found = reached([whole], "src/spin.ts", drew([], [1, 2, 3]))

    expect(found.inReach).toEqual([])
    expect(found.outOfReach).toEqual([])
    expect(found.aboutTheFile.map((one) => one.thread.id)).toEqual(["t8"])
  })

  test("hands the renderer no row for one either", () => {
    const whole = aboutTheFile("t8", "src/spin.ts")

    expect(threadNotes(reached([whole], "src/spin.ts").inReach)).toEqual([])
  })

  test("keeps one about another file out of this one", () => {
    const found = reached([aboutTheFile("t8", "README.md")], "src/spin.ts")

    expect(found.aboutTheFile).toEqual([])
  })

  test("claims nothing is out of reach while the diff has not arrived", () => {
    const far = onLine("t7", "src/spin.ts", 150)

    const found = reached([far], "src/spin.ts", null)

    expect(found.outOfReach).toEqual([])
    expect(found.inReach.map((one) => one.thread.id)).toEqual(["t7"])
  })
})
