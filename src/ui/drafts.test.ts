import { describe, expect, it } from "bun:test"
import { draftAt, draftKey, draftsIn, dropDraft, saveDraft, type Draft } from "./drafts"

const draft = (over: Partial<Draft> = {}): Draft => ({
  path: "src/index.ts",
  side: "additions",
  from: 12,
  to: 14,
  body: "This reads as two things.",
  ...over
})

describe("drafts", () => {
  it("keeps a draft against the lines it is about", () => {
    const kept = saveDraft([], draft())
    expect(kept).toEqual([draft()])
  })

  it("takes an edit as an edit rather than as a second comment", () => {
    const first = saveDraft([], draft())
    const second = saveDraft(first, draft({ body: "Reworded." }))

    expect(second).toHaveLength(1)
    expect(second[0]?.body).toBe("Reworded.")
  })

  it("tells two ranges in one file apart", () => {
    const both = saveDraft(saveDraft([], draft()), draft({ from: 40, to: 40 }))
    expect(both).toHaveLength(2)
  })

  it("tells the same lines on either side of the diff apart", () => {
    const both = saveDraft(saveDraft([], draft()), draft({ side: "deletions" }))
    expect(both).toHaveLength(2)
  })

  it("drops the one asked for and leaves the rest", () => {
    const both = saveDraft(saveDraft([], draft()), draft({ from: 40, to: 40 }))
    const left = dropDraft(both, draftKey(draft()))

    expect(left).toHaveLength(1)
    expect(left[0]?.from).toBe(40)
  })

  it("shows a file only its own drafts", () => {
    const both = saveDraft(saveDraft([], draft()), draft({ path: "README.md" }))
    expect(draftsIn(both, "README.md")).toHaveLength(1)
  })

  it("reads a range dragged out of the diff", () => {
    expect(draftAt("src/index.ts", { side: "deletions", from: 3, to: 9 })).toEqual({
      path: "src/index.ts",
      side: "deletions",
      from: 3,
      to: 9
    })
  })
})
