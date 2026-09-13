import { expect, test } from "bun:test"
import { analyzeTrace, type TraceEvent } from "./trace-analysis"

const mark = (name: string, ts: number): TraceEvent => ({ name, ts, pid: 1, tid: 10, ph: "I" })
const frame = (id: string, sequence: number, state: string, start: number, end: number): TraceEvent[] => [
  { name: "PipelineReporter", ph: "b", pid: 1, tid: 11, ts: start, id2: { local: id }, args: {
    frame_reporter: { state, frame_source: 2, frame_sequence: sequence, layer_tree_host_id: 1 }
  } },
  { name: "PipelineReporter", ph: "e", pid: 1, tid: 11, ts: end, id2: { local: id } }
]

test("frame results exclude other pages, idle frames and duplicate reports", () => {
  const events = [mark("scroll:start", 0), mark("scroll:end", 1_000_000),
    ...frame("a", 1, "STATE_PRESENTED_ALL", 10_000, 20_000),
    ...frame("fork", 1, "STATE_PRESENTED_ALL", 10_000, 20_000),
    ...frame("b", 2, "STATE_DROPPED", 30_000, 40_000),
    ...frame("c", 3, "STATE_NO_UPDATE_DESIRED", 50_000, 60_000),
    ...frame("other", 4, "STATE_DROPPED", 70_000, 80_000).map(e => ({ ...e, pid: 2 })),
    ...frame("old", 5, "STATE_DROPPED", -20_000, -10_000)
  ]
  const result = analyzeTrace(events.reverse(), "scroll")
  expect(result.frames).toMatchObject({ presented: 1, dropped: 1, idle: 1, dropPercent: 50 })
})

test("main-thread work clips to the measurement window without counting nested work twice", () => {
  const events = [mark("load:start", 100_000), mark("load:end", 300_000),
    { name: "RunTask", ph: "X", pid: 1, tid: 10, ts: 80_000, dur: 100_000 },
    { name: "RunTask", ph: "X", pid: 1, tid: 10, ts: 110_000, dur: 20_000 },
    { name: "RunTask", ph: "X", pid: 2, tid: 10, ts: 110_000, dur: 100_000 }
  ]
  expect(analyzeTrace(events, "load").mainThreadMs).toBe(80)
})

test("missing markers and missing frame telemetry cannot produce a healthy frame score", () => {
  expect(() => analyzeTrace([], "scroll")).toThrow("markers")
  const result = analyzeTrace([mark("scroll:start", 0), mark("scroll:end", 100)], "scroll")
  expect(result.frames.dropPercent).toBeNull()
  expect(result.frames.presentedFps).toBeNull()
  expect(result.tasksOverFrameBudget).toBeNull()
})

test("incomplete frame reports invalidate rates while partial presentation remains explicit", () => {
  const events = [mark("scroll:start", 0), mark("scroll:end", 1_000_000),
    ...frame("a", 1, "STATE_PRESENTED_PARTIAL", 10_000, 20_000),
    frame("missing", 2, "STATE_DROPPED", 30_000, 40_000)[0]!
  ]
  expect(analyzeTrace(events, "scroll").frames).toMatchObject({
    presented: 1, partial: 1, incompleteReports: 1, dropPercent: null, presentedFps: null
  })
  expect(() => analyzeTrace([mark("load:start", 0), mark("load:end", Infinity)], "load")).toThrow("markers")
})

test("reused trace IDs pair with their own completion, not a later frame", () => {
  const events = [mark("scroll:start", 0), mark("scroll:end", 50_000),
    ...frame("reused", 1, "STATE_PRESENTED_ALL", 10_000, 20_000),
    ...frame("reused", 2, "STATE_PRESENTED_ALL", 60_000, 80_000)
  ]
  expect(analyzeTrace(events, "scroll").frames.presented).toBe(1)
})

test("unknown frame outcomes invalidate rates instead of disappearing from the denominator", () => {
  const events = [mark("scroll:start", 0), mark("scroll:end", 1_000_000),
    ...frame("known", 1, "STATE_PRESENTED_ALL", 10_000, 20_000),
    ...frame("unknown", 2, "STATE_NEW_OUTCOME", 30_000, 40_000)
  ]
  expect(analyzeTrace(events, "scroll").frames).toMatchObject({
    presented: 1, unknown: 1, dropPercent: null, presentedFps: null
  })
})

test("frame-budget overruns include tasks below the 50 ms long-task threshold", () => {
  const events = [mark("scroll:start", 0), mark("scroll:end", 1_000_000),
    { name: "RunTask", ph: "X", pid: 1, tid: 10, ts: 10_000, dur: 9_000 },
    { name: "RunTask", ph: "X", pid: 1, tid: 10, ts: 30_000, dur: 17_000 },
    { name: "RunTask", ph: "X", pid: 1, tid: 10, ts: 60_000, dur: 51_000 }
  ]
  expect(analyzeTrace(events, "scroll")).toMatchObject({
    tasksOverFrameBudget: { hz60: 2, hz120: 3 }, longTasksMs: [51]
  })
})
