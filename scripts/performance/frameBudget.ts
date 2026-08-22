export type TraceEvent = {
  readonly name: string
  readonly ph: string
  readonly pid: number
  readonly tid: number
  readonly ts: number
  readonly dur?: number
  readonly args?: { readonly name?: unknown }
}

export type Thread = {
  readonly pid: number
  readonly tid: number
}

export type AuditWindow = {
  readonly startUs: number
  readonly endUs: number
}

export type FrameDrop = {
  readonly atMs: number
  readonly durationMs: number
  readonly overBudgetMs: number
}

/** One frame at 60 Hz, expressed in the trace clock's microseconds. */
export const FRAME_BUDGET_US = 1_000_000 / 60

const MAIN_TASKS = new Set(["RunTask", "ThreadControllerImpl::RunTask"])

/** Finds the browser thread that runs page JavaScript, style, and layout. */
export const rendererMainThread = (events: ReadonlyArray<TraceEvent>): Thread | undefined => {
  const named = events.find(
    (event) =>
      event.ph === "M" && event.name === "thread_name" && event.args?.name === "CrRendererMain"
  )
  return named === undefined ? undefined : { pid: named.pid, tid: named.tid }
}

/** Reports each renderer task that can consume more than one 60 Hz frame. */
export const frameDropsIn = (
  events: ReadonlyArray<TraceEvent>,
  window: AuditWindow,
  thread: Thread
): ReadonlyArray<FrameDrop> =>
  events
    .filter((event) => {
      if (
        event.ph !== "X" ||
        !MAIN_TASKS.has(event.name) ||
        event.pid !== thread.pid ||
        event.tid !== thread.tid ||
        event.dur === undefined ||
        event.dur <= FRAME_BUDGET_US
      )
        return false

      const end = event.ts + event.dur
      return event.ts < window.endUs && end > window.startUs
    })
    .map((event) => {
      const durationMs = (event.dur ?? 0) / 1_000
      return {
        atMs: event.ts / 1_000,
        durationMs,
        overBudgetMs: (durationMs * 60 - 1_000) / 60
      }
    })
