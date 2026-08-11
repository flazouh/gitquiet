import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { MergeQueue, MergeState, PullRequestState } from "./PullRequest"
import { faceOf, putsBack, type RowDoing, whatCanBeDone, whatStateAllows } from "./doable"

const ready: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  mayBypass: false,
  update: Option.none(),
  channels: [],
  stack: Option.none()
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

/** The top of a three-deep stack, with the middle layer in whatever state. */
const onTopOf = (middle: PullRequestState): MergeState => ({
  ...ready,
  stack: Option.some({
    number: 11,
    layers: (
      [
        [8, "below", "open"],
        [9, "below", middle],
        [10, "here", "open"]
      ] as const
    ).map(([number, seat, state]) => ({
      reference: { owner: "flazouh", repo: "stack-probe", number },
      title: `layer ${number}`,
      headBranch: `feat-${number}`,
      state,
      seat
    })),
    // Never known from the top of a stack, and never asked here: what may be
    // pressed does not turn on which branch the thing lands in.
    floor: Option.none()
  })
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

  test("merging a layer whose whole landing is ready", () => {
    expect(can("open", onTopOf("open")).has("merge")).toBe(true)
  })

  test("not merging over a draft, whatever GitHub says about this layer alone", () => {
    // The reason a stack cannot be read one pull request at a time. GitHub
    // answers MERGEABLE here, truthfully, about the pull request being read —
    // and the press does not land the pull request being read. It lands this
    // one and the draft underneath it, and their own route refuses that with a
    // sentence about being out of date.
    expect(can("open", onTopOf("draft")).has("merge")).toBe(false)
  })

  test("still offering everything else, since only the merge is impossible", () => {
    expect(can("open", onTopOf("draft")).has("close")).toBe(true)
    expect(can("open", onTopOf("draft")).has("toDraft")).toBe(true)
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

describe("what the state alone allows", () => {
  const allows = (state: PullRequestState) => whatStateAllows(state)

  test("reopening, and only that, once it is closed", () => {
    // The one thing the card declines to offer, because a closed pull request
    // has no merge state worth reading. A row has read the state and nothing
    // else, so it is the place the verb belongs.
    expect([...allows("closed")]).toEqual(["reopen"])
  })

  test("nothing at all once it has landed, there being no way back", () => {
    expect([...allows("merged")]).toEqual([])
  })

  test("closing, drafting and merging for one that is open", () => {
    expect(allows("open")).toEqual(new Set(["merge", "close", "toDraft"]))
  })

  test("marking ready rather than drafting or merging, for a draft", () => {
    expect(allows("draft")).toEqual(new Set(["close", "markReady"]))
  })

  test("never offers the queue or the catch-up, which the state cannot answer", () => {
    // A row does not know whether the repository has a queue or whether the
    // branch is behind, so those verbs stay where the merge state is read. The
    // type says so as well; this says it about the values.
    const offered = new Set(
      ["open", "draft", "closed", "merged"].flatMap((state) => [
        ...allows(state as PullRequestState)
      ])
    )

    expect(offered).toEqual(new Set(["merge", "close", "toDraft", "markReady", "reopen"]))
  })
})

describe("what puts each verb back", () => {
  const back = (doing: RowDoing) => Option.getOrNull(putsBack(doing))

  test("a closed pull request is reopened, and a reopened one closed", () => {
    expect(back("close")).toBe("reopen")
    expect(back("reopen")).toBe("close")
  })

  test("the draft door goes back the way it came, both ways", () => {
    expect(back("toDraft")).toBe("markReady")
    expect(back("markReady")).toBe("toDraft")
  })

  test("nothing puts a merge back, GitHub having no such verb", () => {
    // The fact two surfaces need: a verb with a way back can be offered one
    // afterwards, and a verb without one has to be asked about beforehand.
    expect(back("merge")).toBeNull()
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
