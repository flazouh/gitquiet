import { Effect, Exit } from "effect"
import { describe, expect, test } from "bun:test"
import { demoCard, demoPatches, demoRows, demoWrite } from "./demo"

/**
 * The invented GitHub, checked where it would be embarrassing to be wrong.
 *
 * Not a test of the demo's taste — the titles and the diffs are there to be
 * looked at, and a test cannot tell whether they read like work. What it can
 * tell is that the parts a camera would catch hold together: the stack is a
 * stack, a verb pressed on screen changes the list behind it, and a refusal
 * arrives as a refusal rather than as a window that goes blank.
 */

const run = <A>(work: Effect.Effect<A, unknown>): Promise<A> =>
  Effect.runPromise(work as Effect.Effect<A, never>)

const rowOf = async (number: number) => {
  const rows = await run(demoRows())
  const found = rows.find((it) => it.number === number)
  if (found === undefined) throw new Error(`No demo row #${number}`)
  return found
}

describe("the demo's list", () => {
  test("has a stack in it, each one based on the branch below", async () => {
    // The whole reason for recording this app at all. GitHub grew stacked pull
    // requests in July; the demo has to show one, so the fixture cannot be a
    // list of unrelated rows however plausible each is on its own.
    const [foundation, middle, top] = await Promise.all([
      rowOf(71204),
      rowOf(71219),
      rowOf(71230)
    ])

    expect(middle.baseBranch).toBe(foundation.headBranch)
    expect(top.baseBranch).toBe(middle.headBranch)
  })

  test("has a second stack, so the arrangement does not look like one lucky repository", async () => {
    const [under, over] = await Promise.all([rowOf(14930), rowOf(14944)])

    expect(over.baseBranch).toBe(under.headBranch)
    // The foundation is unreviewed, which is what puts this pile in Waiting while
    // the `next.js` one sits in Needs You.
    expect(under.reviewed).toBe("review-required")
  })

  test("fills all four Courts, so no heading is missing on camera", async () => {
    const rows = await run(demoRows())

    // Needs You needs a shelf of the reader's own. Waiting needs one out for
    // review, where a person owes the answer. Running needs a machine to owe it,
    // which is either a run still going or the merge queue. Settled needs
    // something landed or closed.
    expect(rows.some((it) => it.askedOfViewer)).toBe(true)
    expect(rows.some((it) => it.reviewed === "review-required" && it.viewerIsAuthor)).toBe(true)
    expect(rows.some((it) => it.checks?.state === "running" || it.inMergeQueue)).toBe(true)
    expect(rows.some((it) => it.state === "merged" || it.state === "closed")).toBe(true)
  })

  test("puts every row on a shelf, because one on none is never drawn", async () => {
    // The Working Set is built out of GitHub's shelf queries. A pull request that
    // is neither the reader's own nor asked of them or their team is on no shelf,
    // so it does not appear low down the list — it does not appear. Two rows were
    // written that way and the window quietly drew eighteen of twenty.
    const rows = await run(demoRows())

    for (const it of rows) {
      expect(
        it.viewerIsAuthor || it.askedOfViewer || it.askedOfTeam || it.inMergeQueue,
        `#${it.number} is on none of the reader's shelves`
      ).toBe(true)
    }
  })

  test("says nothing about a pull request that is not in it", async () => {
    const asked = await Effect.runPromiseExit(demoCard({ owner: "acme", repo: "widgets", number: 1 }))

    expect(Exit.isFailure(asked)).toBe(true)
  })
})

describe("a card of the demo", () => {
  test("carries patches whose hunk headers count what is under them", async () => {
    // The first version wrote the `@@` line by hand, the renderer refused it as
    // "too many context lines", and the card took the whole window down with it.
    const patches = await run(
      demoPatches({ owner: "vercel", repo: "next.js", number: 71204 }, [
        "packages/next/src/client/components/router-reducer/router-cache.ts"
      ])
    )

    const patch = patches[0]?.patch ?? ""
    const [, before, after] = patch.match(/^@@ -\d+,(\d+) \+\d+,(\d+) @@/) ?? []
    const lines = patch.split("\n").slice(1)

    expect(Number(before)).toBe(
      lines.filter((line) => line.startsWith(" ") || line.startsWith("-")).length
    )
    expect(Number(after)).toBe(
      lines.filter((line) => line.startsWith(" ") || line.startsWith("+")).length
    )
  })

  test("adds up to the same size the row claims", async () => {
    // Both figures are on screen a press apart. They disagreed once — `+412 −168`
    // in the list, `+108 −21` on the card — which is the sort of thing a viewer
    // notices in a video and a builder never does.
    for (const number of [71204, 231447, 14930, 26044]) {
      const row = await rowOf(number)
      const card = await run(demoCard({ owner: row.owner, repo: row.repo, number }))
      const sum = (of: (file: { linesAdded: number; linesDeleted: number }) => number): number =>
        card.files.reduce((total, file) => total + of(file), 0)

      expect(sum((file) => file.linesAdded)).toBe(row.added)
      expect(sum((file) => file.linesDeleted)).toBe(row.deleted)
    }
  })

  test("has something to read in its conversation and its checks", async () => {
    const card = await run(demoCard({ owner: "vercel", repo: "next.js", number: 71204 }))

    expect(card.threads.some((thread) => !thread.isResolved)).toBe(true)
    expect(card.threads.some((thread) => thread.isResolved)).toBe(true)
    expect(card.remarks.length).toBeGreaterThan(0)
    expect(card.checks.length).toBeGreaterThan(0)
  })
})

describe("a verb pressed in the demo", () => {
  test("closes one, and the list agrees afterwards", async () => {
    const card = { owner: "withastro", repo: "astro", number: 12194 }

    await run(demoWrite(card, { doing: "close" }))

    expect((await rowOf(12194)).state).toBe("closed")
    expect((await run(demoCard(card))).state).toBe("closed")
  })

  test("refuses to merge one nobody approved, in GitHub's own words", async () => {
    // A demo that can only succeed is a demo of half the interface: the toast
    // that says what GitHub refused is worth as much screen time as the merge.
    const asked = await Effect.runPromiseExit(
      demoWrite({ owner: "denoland", repo: "deno", number: 26011 }, { doing: "merge", method: "SQUASH" })
    )

    expect(Exit.isFailure(asked)).toBe(true)
    expect((await rowOf(26011)).state).toBe("open")
  })

  test("merges one that is approved, and the card stops offering to", async () => {
    const card = { owner: "vercel", repo: "next.js", number: 71204 }

    await run(demoWrite(card, { doing: "merge", method: "SQUASH" }))

    const after = await run(demoCard(card))
    expect(after.state).toBe("merged")
    expect(after.mergedAt).not.toBeNull()
  })

  test("queues one, and takes it out again", async () => {
    const card = { owner: "tailwindlabs", repo: "tailwindcss", number: 14855 }

    await run(demoWrite(card, { doing: "dequeue" }))
    expect((await rowOf(14855)).inMergeQueue).toBe(false)

    await run(demoWrite(card, { doing: "enqueue", how: "GROUP" }))
    expect((await rowOf(14855)).inMergeQueue).toBe(true)
  })
})
