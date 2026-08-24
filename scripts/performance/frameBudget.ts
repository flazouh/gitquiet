export type TraceEvent = {
  readonly name: string
  readonly ph: string
  readonly pid: number
  readonly tid: number
  readonly ts: number
  readonly dur?: number
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
