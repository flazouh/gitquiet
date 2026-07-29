import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { MergeQueue, MergeState, PullRequestState } from "./PullRequest"
import { faceOf, whatCanBeDone } from "./doable"

const ready: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  mayBypass: false,
  update: Option.none(),
  channels: []
}

const inA = (queue: Partial<MergeQueue>): MergeState => ({
  ...ready,
  queue: Option.some({
    waiting: false,
    position: Option.none(),
    viewerCanQueue: true,
    mayJoin: true,
    url: Option.none(),
    ...queue
  })
})

const behind = (mayUpdate: boolean): MergeState => ({
  ...ready,
  update: Option.some({ how: "MERGE", mayUpdate, refusal: Option.none() })
})

const can = (state: PullRequestState, merge: MergeState = ready) => whatCanBeDone({ state, merge })

describe("what can be done to a pull request", () => {
  test("nothing at all, once it has been merged", () => {
    // The one that started this: a merged pull request whose card still offered
    // to queue it, because every button worked out its own answer from the
    // merge state and none of them asked whether the thing was still alive.
    expect([...can("merged", inA({}))]).toEqual([])
  })

  test("nothing at all once it is closed either, GitHub's own reopening aside", () => {
    expect([...can("closed", behind(true))]).toEqual([])
  })

  test("merging, closing and drafting, for one that is open and ready", () => {
    expect(can("open")).toEqual(new Set(["merge", "close", "toDraft"]))
  })

  test("everything but merging, while GitHub is blocking it", () => {
    const blocked: MergeState = { ...ready, isMergeable: false }

    expect(can("open", blocked).has("merge")).toBe(false)
    expect(can("open", blocked).has("close")).toBe(true)
  })

  test("marking ready rather than merging, a draft being unmergeable by rule", () => {
    const asked = can("draft")

    expect(asked.has("markReady")).toBe(true)
    expect(asked.has("merge")).toBe(false)
    expect(asked.has("toDraft")).toBe(false)
  })

  test("catching the branch up only where GitHub says the reader may", () => {
    expect(can("open", behind(true)).has("update")).toBe(true)
    expect(can("open", behind(false)).has("update")).toBe(false)
  })

  describe("a repository that lands through a queue", () => {
    test("offers the queue instead of the merge, which GitHub would refuse", () => {
      const asked = can("open", inA({}))

      expect(asked.has("enqueue")).toBe(true)
      expect(asked.has("merge")).toBe(false)
    })

    test("offers to take it out again once it is standing in the line", () => {
      const asked = can("open", inA({ waiting: true }))

      expect(asked.has("dequeue")).toBe(true)
      expect(asked.has("enqueue")).toBe(false)
    })

    test("offers to call off a merge GitHub is already holding", () => {
      const held: MergeState = {
        ...inA({}),
        autoMerge: Option.some({ method: Option.none(), viewerCanCancel: true })
      }

      expect(can("open", held).has("cancel")).toBe(true)
      expect(can("open", held).has("enqueue")).toBe(false)
    })

    test("offers nothing of the queue to a reader who may not touch it", () => {
      expect(can("open", inA({ viewerCanQueue: false })).has("enqueue")).toBe(false)
      expect(can("open", inA({ waiting: true, viewerCanQueue: false })).has("dequeue")).toBe(false)
    })

    test("offers nothing where GitHub would not take this one in yet", () => {
      expect(can("open", inA({ mayJoin: false })).has("enqueue")).toBe(false)
    })

    test("holds a draft out of the line as well as out of the merge", () => {
      expect(can("draft", inA({})).has("enqueue")).toBe(false)
    })
  })
})

describe("the face the merge card wears", () => {
  test("is settled for one that has landed, and says which way it went", () => {
    const face = faceOf({ state: "merged", merge: inA({}) })

    expect(face.kind).toBe("settled")
    expect(face.kind === "settled" ? face.how : null).toBe("merged")
  })

  test("is settled for a closed one too", () => {
    expect(faceOf({ state: "closed", merge: ready }).kind).toBe("settled")
  })

  test("carries the merge state and the verbs while it is still live", () => {
    const face = faceOf({ state: "open", merge: behind(true) })

    expect(face.kind).toBe("live")
    expect(face.kind === "live" ? face.can.has("update") : false).toBe(true)
  })

  test("says which of the three queue verbs this one is at, so nothing else has to", () => {
    const at = (merge: MergeState) => {
      const face = faceOf({ state: "open", merge })
      return face.kind === "live" ? Option.getOrNull(face.queueing) : "settled"
    }

    expect(at(ready)).toBeNull()
    expect(at(inA({}))).toBe("enqueue")
    expect(at(inA({ waiting: true }))).toBe("dequeue")
    expect(
      at({ ...inA({}), autoMerge: Option.some({ method: Option.none(), viewerCanCancel: false }) })
    ).toBe("cancel")
  })

  test("names the verb even where the reader may not press it", () => {
    // Which button to show and whether it may be pressed are two questions. A
    // reader without the permission still gets told what the control would do,
    // greyed out, rather than being shown nothing at all.
    const face = faceOf({ state: "open", merge: inA({ waiting: true, viewerCanQueue: false }) })

    expect(face.kind === "live" ? Option.getOrNull(face.queueing) : null).toBe("dequeue")
    expect(face.kind === "live" ? face.can.has("dequeue") : true).toBe(false)
  })

  test("says whether the draft door goes in or out, which the state decides", () => {
    expect(faceOf({ state: "draft", merge: ready }).kind === "live").toBe(true)
    const draft = faceOf({ state: "draft", merge: ready })
    const open = faceOf({ state: "open", merge: ready })

    expect(draft.kind === "live" ? draft.drafting : null).toBe("markReady")
    expect(open.kind === "live" ? open.drafting : null).toBe("toDraft")
  })
})
