import { describe, expect, test } from "bun:test"
import type { Check, CheckState } from "./PullRequest"
import { failing, howTheRunStands, stillRunning } from "./checks"

const check = (state: CheckState, name: string = state): Check => ({
  name,
  state,
  isRequired: true,
  summary: "",
  url: "",
  durationSeconds: 1
})

const run = (...states: ReadonlyArray<CheckState>) =>
  states.map((state, at) => check(state, `${state}-${at}`))

describe("where a run of checks stands", () => {
  test("is red the moment one of them failed, however many have not finished", () => {
    // A failure is the answer whatever else is happening: nobody waits for the
    // rest of a run to find out whether they have to fix something.
    const standing = howTheRunStands(run("failed", "succeeded", "running", "queued"))

    expect(standing).toEqual({ kind: "red", failed: 1, total: 4 })
  })

  test("is running while anything is unfinished, which is not the same as passed", () => {
    // The whole point of this type. This used to be computed in the summary of
    // the checks panel, where "nothing failed" was read as "everything passed"
    // and a run two minutes old announced itself as green.
    const standing = howTheRunStands(run("succeeded", "succeeded", "running", "queued"))

    expect(standing).toEqual({ kind: "running", waiting: 2, total: 4, started: true })
  })

  test("knows a run that has not begun from one that is under way", () => {
    // A queue is a wait that has not started, and a turning spinner over it is
    // the same small lie as calling it passed.
    expect(howTheRunStands(run("queued", "queued"))).toEqual({
      kind: "running",
      waiting: 2,
      total: 2,
      started: false
    })
  })

  test("has passed when every one of them is green", () => {
    expect(howTheRunStands(run("succeeded", "succeeded"))).toEqual({ kind: "passed", total: 2 })
  })

  test("counts skipped and neutral as green, the way GitHub's own summary does", () => {
    // A job the workflow decided not to run is not a job anybody is waiting on,
    // and GitHub reports it among the successful ones.
    expect(howTheRunStands(run("succeeded", "skipped", "neutral"))).toEqual({
      kind: "passed",
      total: 3
    })
  })

  test("stops short of passed when something was cancelled", () => {
    // Nothing failed and nothing is running, but a cancelled check did not pass
    // either, and a run with one in it has not been given the all clear.
    expect(howTheRunStands(run("succeeded", "cancelled"))).toEqual({
      kind: "stopped",
      green: 1,
      total: 2
    })
  })
})

describe("the checks a card asks about directly", () => {
  test("failing gives the ones to show open, since those are the ones read", () => {
    const red = failing(run("succeeded", "failed", "running"))

    expect(red.map((check) => check.state)).toEqual(["failed"])
  })

  test("stillRunning counts the queued along with the started", () => {
    expect(stillRunning(run("running", "queued", "succeeded", "failed"))).toBe(2)
  })
})
