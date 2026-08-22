import { describe, expect, test } from "bun:test"
import { frameDropsIn, rendererMainThread, type TraceEvent } from "./frameBudget"

const trace: ReadonlyArray<TraceEvent> = [
  {
    name: "thread_name",
    ph: "M",
    pid: 7,
    tid: 11,
    ts: 0,
    args: { name: "CrRendererMain" }
  },
  { name: "RunTask", ph: "X", pid: 7, tid: 11, ts: 1_000, dur: 8_000 },
  { name: "RunTask", ph: "X", pid: 7, tid: 11, ts: 10_000, dur: 17_000 },
  {
    name: "ThreadControllerImpl::RunTask",
    ph: "X",
    pid: 7,
    tid: 11,
    ts: 30_000,
    dur: 42_000
  },
  { name: "RunTask", ph: "X", pid: 7, tid: 12, ts: 30_000, dur: 90_000 }
]

describe("the strict frame budget", () => {
  test("finds the renderer main thread", () => {
    expect(rendererMainThread(trace)).toEqual({ pid: 7, tid: 11 })
  })

  test("reports every main-thread task that exceeds one 60 Hz frame", () => {
    expect(
      frameDropsIn(trace, { startUs: 9_000, endUs: 80_000 }, { pid: 7, tid: 11 })
    ).toEqual([
      { atMs: 10, durationMs: 17, overBudgetMs: 1 / 3 },
      { atMs: 30, durationMs: 42, overBudgetMs: 25 + 1 / 3 }
    ])
  })

  test("counts a task that crosses the start of the measured action", () => {
    expect(
      frameDropsIn(trace, { startUs: 20_000, endUs: 30_000 }, { pid: 7, tid: 11 })
    ).toEqual([{ atMs: 10, durationMs: 17, overBudgetMs: 1 / 3 }])
  })
})
