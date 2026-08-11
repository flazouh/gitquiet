import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { loadWorkingSet } from "../../../src/app/workingSet"
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
  id: 1,
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
})
