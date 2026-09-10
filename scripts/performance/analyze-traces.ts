import { join } from "node:path"
import { analyzeTrace, type TraceEvent } from "./trace-analysis"

const directory = join(process.cwd(), process.argv[2] ?? ".tmp/performance-traces")
type RecordedRun = {
  name: string
  page: { diffAt: number; navigation: { responseStart: number }[] }
}
const runs: {
  config: { interactions?: boolean; containmentExperiment?: boolean }
  results: RecordedRun[]
} = await Bun.file(join(directory, "runs.json")).json()
const phaseNames = ["load", "scroll", "panel"]
if (runs.config.interactions) phaseNames.push("diff-scroll", "selection")
if (runs.config.containmentExperiment) phaseNames.push("contained-scroll")
const summaries = []
for (const run of runs.results) {
  const trace: { traceEvents: TraceEvent[] } = await Bun.file(join(directory, `${run.name}.trace.json`)).json()
  const phases = Object.fromEntries(phaseNames.map(phase => [phase, analyzeTrace(trace.traceEvents, phase)]))
  const firstByte = run.page.navigation[0]?.responseStart
  summaries.push({ ...run, phases, responseToDiffMs: firstByte === undefined ? null : run.page.diffAt - firstByte })
  console.log({ name: run.name, diffReadyMs: run.page.diffAt,
    phases: Object.fromEntries(Object.entries(phases).map(([name, result]) => [name, {
      mainThreadMs: result.mainThreadMs, longTasksMs: result.longTasksMs, frames: result.frames
    }]))
  })
}
const calibration = []
for (const mode of ["idle", "blocked"]) {
  const trace: { traceEvents: TraceEvent[] } = await Bun.file(join(directory, `calibration-${mode}.trace.json`)).json()
  calibration.push({ mode, ...analyzeTrace(trace.traceEvents, "calibration") })
}
await Bun.write(join(directory, "summary.json"), JSON.stringify({ config: runs.config, calibration, summaries }, null, 2))
console.log({ calibration })
