export type TraceEvent = {
  name: string
  ts: number
  pid: number
  tid: number
  ph: string
  dur?: number
  id2?: { local?: string }
  args?: { frame_reporter?: {
    state: string
    frame_source: number
    frame_sequence: number
    layer_tree_host_id: number
  } }
}

type TimeRange = [start: number, end: number]

const merged = (ranges: TimeRange[]) => {
  const result: TimeRange[] = []
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1)
    if (last !== undefined && range[0] < last[1]) last[1] = Math.max(last[1], range[1])
    else result.push([...range])
  }
  return result
}

/** Reads Chromium frame outcomes, not requestAnimationFrame callback cadence. */
export const analyzeTrace = (events: readonly TraceEvent[], phase: string) => {
  const start = events.find(e => e.name === `${phase}:start`)
  const end = events.find(e => e.name === `${phase}:end`)
  if (!start || !end || start.pid !== end.pid || !Number.isFinite(start.ts) ||
    !Number.isFinite(end.ts) || end.ts <= start.ts) throw new Error(`Invalid ${phase} markers`)
  const durationMs = (end.ts - start.ts) / 1000
  const scoped = events.filter(e => e.pid === start.pid)
  const ranges = merged(scoped.filter(e => e.tid === start.tid &&
    (e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask") &&
    e.ph === "X" && Number.isFinite(e.dur) && e.dur! > 0 && e.ts < end.ts && e.ts + e.dur! > start.ts
  ).map(e => [Math.max(start.ts, e.ts), Math.min(end.ts, e.ts + e.dur!)]))
  const taskDurations = ranges.map(([a, b]) => (b - a) / 1000)
  const frames = new Map<string, { states: Set<string>; at: number }>()
  // Chromium reuses reporter IDs. Match each lifetime in timestamp order.
  const endings = new Map<TraceEvent, number>()
  const pending = new Map<string, TraceEvent[]>()
  for (const event of scoped.filter(e => e.name === "PipelineReporter").sort((a, b) => a.ts - b.ts)) {
    const id = event.id2?.local
    if (id === undefined) continue
    if (event.ph === "b") {
      const stack = pending.get(id) ?? []
      stack.push(event)
      pending.set(id, stack)
    } else if (event.ph === "e") {
      const began = pending.get(id)?.pop()
      if (began !== undefined) endings.set(began, event.ts)
    }
  }
  let incompleteReports = 0
  for (const event of scoped) {
    const report = event.args?.frame_reporter
    if (event.name !== "PipelineReporter" || event.ph !== "b" || !report ||
      event.ts < start.ts || event.ts >= end.ts) continue
    const at = endings.get(event)
    if (at === undefined || at < event.ts) { incompleteReports++; continue }
    if (at > end.ts) continue
    const key = `${report.layer_tree_host_id}:${report.frame_source}:${report.frame_sequence}`
    const frame = frames.get(key) ?? { states: new Set<string>(), at }
    frame.states.add(report.state)
    frame.at = Math.max(frame.at, at)
    frames.set(key, frame)
  }
  let presented = 0, dropped = 0, partial = 0, mixedReports = 0, idle = 0, unknown = 0
  const presentations: number[] = []
  const knownStates = new Set(["STATE_PRESENTED_ALL", "STATE_PRESENTED_PARTIAL", "STATE_DROPPED", "STATE_NO_UPDATE_DESIRED"])
  for (const frame of frames.values()) {
    if ([...frame.states].some(state => !knownStates.has(state))) unknown++
    if ([...frame.states].some(state => state.startsWith("STATE_PRESENTED"))) {
      presented++
      presentations.push(frame.at)
      if ([...frame.states].some(state => state.startsWith("STATE_PRESENTED_PARTIAL"))) partial++
      if (frame.states.has("STATE_DROPPED")) mixedReports++
    } else if (frame.states.has("STATE_DROPPED")) dropped++
    else if (frame.states.has("STATE_NO_UPDATE_DESIRED")) idle++
  }
  presentations.sort((a, b) => a - b)
  const gaps = presentations.slice(1).map((at, i) => (at - presentations[i]!) / 1000).sort((a, b) => a - b)
  const measured = presented + dropped > 0 && incompleteReports === 0 && unknown === 0
  return {
    durationMs, rendererPid: start.pid,
    mainThreadMs: taskDurations.length ? taskDurations.reduce((a, b) => a + b, 0) : null,
    longTasksMs: taskDurations.filter(ms => ms > 50),
    tasksOverFrameBudget: taskDurations.length ? {
      hz60: taskDurations.filter(ms => ms > 1000 / 60).length,
      hz120: taskDurations.filter(ms => ms > 1000 / 120).length
    } : null,
    frames: { presented, dropped, partial, mixedReports, idle, incompleteReports, unknown,
      dropPercent: measured ? dropped / (presented + dropped) * 100 : null,
      presentedFps: measured ? presented / (durationMs / 1000) : null,
      gapP95Ms: gaps.length ? gaps[Math.ceil(gaps.length * .95) - 1]! : null,
      gapMaxMs: gaps.at(-1) ?? null
    }
  }
}
