import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { aComment, aThread, anchoredAt, person } from "../../tests/snapshots"
import type { ReviewThread, ThreadAnchor } from "../domain/PullRequest"
import { threadKey, threadNotes, threadsIn } from "./threads"

const at = (
  path: string,
  line: number,
  side: ThreadAnchor["side"] = "after",
  startLine = line
): Option.Option<ThreadAnchor> => Option.some({ path, side, line, startLine })

const onLine = (id: string, path: string, line: number): ReviewThread =>
  aThread(id, [aComment(person("ana"), `about ${path}:${line}`)], false, anchoredAt(path, line))

describe("putting a review thread back on its line", () => {
  test("keeps only the threads belonging to the file being read", () => {
    const found = threadsIn(
      [onLine("t1", "src/spin.ts", 12), onLine("t2", "README.md", 3)],
      "src/spin.ts"
    )

    expect(found.map((one) => one.thread.id)).toEqual(["t1"])
  })

  test("leaves out a thread about the pull request rather than about a line", () => {
    const loose = aThread("t9", [aComment(person("ana"), "looks good overall")])

    expect(threadsIn([loose], "src/spin.ts")).toEqual([])
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
    expect(threadNotes([spanning], "src/spin.ts")).toEqual([
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

    expect(threadNotes([gone], "src/spin.ts")).toEqual([
      { key: "thread:t4", side: "deletions", line: 27 }
    ])
  })

  test("names a row after the thread, so it survives the file being redrawn", () => {
    expect(threadKey(onLine("t5", "src/spin.ts", 9))).toBe("thread:t5")
  })
})
