import { describe, expect, test } from "bun:test"
import {
  AUTHOR,
  VIEWER,
  aCheck,
  aComment,
  aFile,
  aReview,
  aSnapshot,
  aThread,
  asAuthor,
  bot,
  person
} from "../../tests/snapshots"
import { deriveAttention } from "./deriveAttention"

const courtOf = (snapshot: Parameters<typeof deriveAttention>[0], id: string) =>
  deriveAttention(snapshot).items.find((item) => item.id === id)?.court

describe("every Attention Item sits in exactly one Court", () => {
  const busy = aSnapshot({
    files: [aFile("a.ts"), aFile("b.ts", true)],
    threads: [
      aThread("1", [aComment(person("someone"))]),
      aThread("2", [aComment(person(VIEWER))]),
      aThread("3", [aComment(bot("Copilot"))], true)
    ],
    checks: [aCheck("build", "failed"), aCheck("lint", "succeeded")],
    reviews: [aReview("reviewer-two", "changes-requested")],
    merge: { isMergeable: false, blockers: [{ name: "Repo rules", explanation: "nope" }] }
  })

  test("no item is listed twice", () => {
    const { items } = deriveAttention(busy)
    const ids = items.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  test("the rows account for every item and nothing more", () => {
    const attention = deriveAttention(busy)
    const inRows = attention.rows.flatMap((row) => row.items)

    expect(inRows).toHaveLength(attention.items.length)
    expect(new Set(inRows.map((item) => item.id))).toEqual(
      new Set(attention.items.map((item) => item.id))
    )
  })

  test("each row holds one kind in one Court", () => {
    const attention = deriveAttention(busy)

    for (const row of attention.rows) {
      expect(row.items.every((item) => item.kind === row.kind)).toBe(true)
      expect(row.items.every((item) => item.court === row.court)).toBe(true)
    }
  })

  test("no row is empty", () => {
    const attention = deriveAttention(busy)

    expect(attention.rows.every((row) => row.items.length > 0)).toBe(true)
  })
})

describe("an Author and a Reviewer looking at the same pull request", () => {
  const parts = {
    files: [aFile("a.ts")],
    checks: [aCheck("build", "failed")],
    reviews: [aReview("reviewer-two", "changes-requested")],
    merge: { isMergeable: false, blockers: [{ name: "Repo rules", explanation: "nope" }] }
  }

  test("the Reviewer is asked to read the files", () => {
    const attention = deriveAttention(aSnapshot(parts))

    expect(attention.role).toBe("reviewer")
    expect(attention.items.filter((item) => item.kind === "file")).toHaveLength(1)
    expect(courtOf(aSnapshot(parts), "file:a.ts")).toBe("your-move")
  })

  test("the Author is not asked to read their own files", () => {
    const attention = deriveAttention(asAuthor(parts))

    expect(attention.role).toBe("author")
    expect(attention.items.filter((item) => item.kind === "file")).toHaveLength(0)
  })

  test("a failing check is the Author's move and the Reviewer's wait", () => {
    expect(courtOf(asAuthor(parts), "check:build")).toBe("your-move")
    expect(courtOf(aSnapshot(parts), "check:build")).toBe("waiting-on-others")
  })

  test("a requested change is the Author's move and the Reviewer's wait", () => {
    expect(courtOf(asAuthor(parts), "review:reviewer-two")).toBe("your-move")
    expect(courtOf(aSnapshot(parts), "review:reviewer-two")).toBe("waiting-on-others")
  })

  test("a merge blocker is the Author's move and the Reviewer's wait", () => {
    expect(courtOf(asAuthor(parts), "merge-blocker:Repo rules")).toBe("your-move")
    expect(courtOf(aSnapshot(parts), "merge-blocker:Repo rules")).toBe("waiting-on-others")
  })

  test("they see different Your Move counts", () => {
    expect(deriveAttention(aSnapshot(parts)).yourMoveCount).not.toBe(
      deriveAttention(asAuthor(parts)).yourMoveCount
    )
  })
})

describe("who owes the next word in a thread", () => {
  test("someone else spoke last, so it is the Participant's move", () => {
    const snapshot = aSnapshot({
      threads: [aThread("1", [aComment(person(VIEWER)), aComment(person("someone"))])]
    })

    expect(courtOf(snapshot, "thread:1")).toBe("your-move")
  })

  test("the Participant spoke last, so they are waiting on others", () => {
    const snapshot = aSnapshot({
      threads: [aThread("1", [aComment(person("someone")), aComment(person(VIEWER))])]
    })

    expect(courtOf(snapshot, "thread:1")).toBe("waiting-on-others")
  })

  test("a resolved thread is settled whoever spoke last", () => {
    const snapshot = aSnapshot({
      threads: [aThread("1", [aComment(person("someone"))], true)]
    })

    expect(courtOf(snapshot, "thread:1")).toBe("settled")
  })
})

describe("telling bots apart from people", () => {
  test("a thread only bots have written to is a finding", () => {
    const snapshot = aSnapshot({
      threads: [aThread("1", [aComment(bot("Copilot")), aComment(bot("Sonar"))])]
    })

    expect(deriveAttention(snapshot).items[0]?.kind).toBe("finding")
  })

  test("a thread a person joined is a thread again", () => {
    const snapshot = aSnapshot({
      threads: [aThread("1", [aComment(bot("Copilot")), aComment(person("someone"))])]
    })

    expect(deriveAttention(snapshot).items[0]?.kind).toBe("thread")
  })
})

describe("draining Your Move to zero", () => {
  test("a pull request with nothing outstanding owes the Participant nothing", () => {
    const settled = aSnapshot({
      files: [aFile("a.ts", true)],
      threads: [aThread("1", [aComment(person("someone"))], true)],
      checks: [aCheck("build", "succeeded")],
      reviews: [aReview("reviewer-two", "approved")]
    })

    const attention = deriveAttention(settled)

    expect(attention.yourMoveCount).toBe(0)
    expect(attention.rows.every((row) => row.court === "settled")).toBe(true)
  })

  test("reading a file takes it out of Your Move", () => {
    const before = deriveAttention(aSnapshot({ files: [aFile("a.ts")] }))
    const after = deriveAttention(aSnapshot({ files: [aFile("a.ts", true)] }))

    expect(before.yourMoveCount).toBe(1)
    expect(after.yourMoveCount).toBe(0)
  })
})

describe("a pull request that is over", () => {
  test("a merged pull request needs nothing from anyone", () => {
    const merged = aSnapshot({
      state: "merged",
      files: [aFile("a.ts")],
      threads: [aThread("1", [aComment(person("someone"))])],
      checks: [aCheck("build", "failed")]
    })

    const attention = deriveAttention(merged)

    expect(attention.yourMoveCount).toBe(0)
    expect(attention.items.every((item) => item.court === "settled")).toBe(true)
  })
})

describe("correcting a Court by hand", () => {
  const snapshot = aSnapshot({ files: [aFile("a.ts")] })

  test("the correction wins over what was derived", () => {
    const attention = deriveAttention(snapshot, [
      { itemId: "file:a.ts", court: "settled" }
    ])

    expect(courtOf(snapshot, "file:a.ts")).toBe("your-move")
    expect(attention.items[0]?.court).toBe("settled")
    expect(attention.yourMoveCount).toBe(0)
  })

  test("a correction for something else leaves the item alone", () => {
    const attention = deriveAttention(snapshot, [
      { itemId: "file:elsewhere.ts", court: "settled" }
    ])

    expect(attention.items[0]?.court).toBe("your-move")
  })

  test("item identity does not depend on order or position, so it survives a push", () => {
    const before = deriveAttention(aSnapshot({ files: [aFile("a.ts"), aFile("b.ts")] }))
    const afterPush = deriveAttention(aSnapshot({ files: [aFile("b.ts"), aFile("a.ts")] }))

    expect(new Set(before.items.map((item) => item.id))).toEqual(
      new Set(afterPush.items.map((item) => item.id))
    )
  })
})

describe("what the Participant reads first", () => {
  test("conversation outranks the reading", () => {
    const snapshot = aSnapshot({
      files: [aFile("a.ts")],
      threads: [aThread("1", [aComment(person("someone"))])]
    })

    const yourMove = deriveAttention(snapshot).rows.filter(
      (row) => row.court === "your-move"
    )

    expect(yourMove.map((row) => row.kind)).toEqual(["thread", "file"])
  })

  test("Your Move comes before what others owe, which comes before settled", () => {
    const snapshot = aSnapshot({
      files: [aFile("a.ts"), aFile("read.ts", true)],
      threads: [aThread("1", [aComment(person(VIEWER))])]
    })

    const courts = deriveAttention(snapshot).rows.map((row) => row.court)

    expect(courts).toEqual(["your-move", "waiting-on-others", "settled"])
  })
})

describe("recognising the Participant", () => {
  test("the viewer who opened the pull request is its Author", () => {
    expect(deriveAttention(asAuthor()).role).toBe("author")
    expect(deriveAttention(aSnapshot()).role).toBe("reviewer")
    expect(AUTHOR).not.toBe(VIEWER)
  })
})
