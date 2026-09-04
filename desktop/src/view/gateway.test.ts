import { describe, expect, mock, test } from "bun:test"

mock.module("./rpc", () => ({
  ask: async (what: string) => {
    if (what === "involvedIssues") return { ok: true, it: [] }
    throw new Error(`this test did not expect ${what}`)
  }
}))
import { Effect, Option } from "effect"
import { loadWorkingSet, rememberedWorkingSet } from "../../../src/app/workingSet"
import type { WorkingSetRow } from "../shared/wire"

/*
 * The module builds an `Electroview` when it is imported, which expects the
 * preload's object to be on the window. Nothing here talks to the bridge — the
 * whole point is the half of the gateway that answers from the rows — so the
 * object is enough, and the import comes after it exists.
 */
const gatewayFrom = async () => {
  const on = globalThis as { __electrobun?: unknown }
  on.__electrobun ??= {}
  return (await import("./gateway")).gatewayFrom
}

const ROW: WorkingSetRow = {
  id: "1",
  owner: "flazouh",
  repo: "working-set",
  number: 7,
  title: "Give the window its list back",
  authorLogin: "flazouh",
  authorIsBot: false,
  authorFaceUrl: null,
  state: "open",
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-31T10:00:00Z",
  changedAt: "2026-07-31T12:00:00Z",
  headSha: "abc123",
  added: 12,
  deleted: 3,
  baseBranch: "main",
  headBranch: "window-list",
  checks: null,
  reviewed: null,
  viewerIsAuthor: true,
  askedOfViewer: false,
  askedOfTeam: false,
  inMergeQueue: false
}

describe("the working set the window builds out of the rows it was handed", () => {
  /*
   * The fault this guards is a window that waits forever.
   *
   * `loadWorkingSet` asks the gateway for what the store already knows about
   * these rows, and this layer did not answer that question at all: the call
   * was on an undefined property, which is a defect rather than a failure, and
   * a defect does not reach the screen's word for "this went wrong". The read
   * simply stopped, four seconds after GitHub had already said everything, and
   * the window sat on "Reading your pull requests…" with nothing in either
   * console to say why.
   */
  test("arrives, rather than stopping on a question this layer forgot to answer", async () => {
    const build = await gatewayFrom()

    const sittings = await Effect.runPromise(
      loadWorkingSet().pipe(Effect.provide(build([ROW])))
    )

    expect(
      sittings.flatMap((sitting) => sitting.piles.map((pile) => pile.one.reference.number))
    ).toEqual([7])
  })

  /*
   * The same fault, one question over, and this one is the whole reason the window
   * keeps anything at all.
   *
   * Pressing back to the list read the rows off disk in about a millisecond and then
   * stopped: `rememberedRows` answered with the branches and the sizes and left the
   * standings off, so arranging them was a read of a property that was not there.
   * The memory never reached the screen. What the reader got instead was "Reading
   * your pull requests…" for eight seconds — measured — with a list of fifty-two rows
   * sitting in `localStorage` the entire time.
   */
  test("hands back the list it kept, which is what makes going back instant", async () => {
    const build = await gatewayFrom()
    const green = { state: "passing", total: 3, passed: 3 } as const

    const remembered = await Effect.runPromise(
      rememberedWorkingSet().pipe(Effect.provide(build([{ ...ROW, checks: green }])))
    )

    const sittings = Option.getOrThrow(remembered)

    expect(
      sittings.flatMap((sitting) => sitting.piles.map((pile) => pile.one.reference.number))
    ).toEqual([7])
    // The standings among them, those being the half that was missing: a list drawn
    // without them is a row of pull requests with no word for their checks.
    expect(sittings.flatMap((sitting) => sitting.piles.map((pile) => pile.one.checks))).toEqual([
      Option.some(green)
    ])
  })

  test("wears a write of ours over a row GitHub still calls open", async () => {
    const { forgetLanded, recordLanded } = await import("../../../src/github/landed")
    const build = await gatewayFrom()
    recordLanded({ owner: ROW.owner, repo: ROW.repo, number: ROW.number }, "closed")

    const sittings = await Effect.runPromise(loadWorkingSet().pipe(Effect.provide(build([ROW]))))

    expect(sittings.map((sitting) => sitting.court)).toEqual(["settled"])
    expect(sittings.flatMap((sitting) => sitting.piles.map((pile) => pile.one.state))).toEqual([
      "closed"
    ])
    forgetLanded()
  })

  test("keeps nothing at all when it was handed nothing, rather than an empty list", async () => {
    /*
     * A confident empty list painted over a read that has not finished is worse than
     * the bones: it says "nothing needs you" to a reader who has fifty rows waiting.
     */
    const build = await gatewayFrom()

    const nothing = await Effect.runPromise(
      rememberedWorkingSet().pipe(Effect.provide(build([])))
    )

    expect(nothing).toEqual(Option.none())
  })
})
