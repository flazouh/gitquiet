/**
 * What the thread is doing while it will not answer.
 *
 * `probe-blob-freeze` says a page is held; this says by what. Measured on
 * `spf13/cobra`'s `command.go`, where the tab answers nothing for forty seconds
 * with this extension and answers two hundred and forty asks without it.
 *
 * A CPU profile rather than a guess: the Ledger reads that file in 78ms and
 * Shiki colours it in 599ms — faster than a TypeScript file twice its length
 * that does not freeze at all — so the cost is somewhere neither of those two
 * suspicions reached.
 *
 *     bun run build && bun scripts/probe-blob-profile.ts [--page URL] [--for 45000]
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/spf13/cobra/blob/main/command.go"
const FOR = Number(argued("--for") ?? 45_000)
const EXTENSION = argued("--extension") ?? `${import.meta.dir}/../.output/chrome-mv3`
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

type Node = {
  readonly id: number
  readonly hitCount?: number
  readonly callFrame: { readonly functionName: string; readonly url: string; readonly lineNumber: number }
}

const session = await withExtension(PAGE, EXTENSION, { awaitLoad: false })

try {
  await session.tab.send("Profiler.enable")
  await session.tab.send("Profiler.start")
  await sleep(FOR)
  const stopped = await session.tab.send<{ profile: { nodes: ReadonlyArray<Node>; startTime: number; endTime: number } }>(
    "Profiler.stop"
  )

  const { nodes, startTime, endTime } = stopped.profile
  const ticks = nodes.reduce((running, one) => running + (one.hitCount ?? 0), 0)
  const span = (endTime - startTime) / 1000

  const worst = [...nodes]
    .filter((one) => (one.hitCount ?? 0) > 0)
    .sort((one, two) => (two.hitCount ?? 0) - (one.hitCount ?? 0))
    .slice(0, 12)
    .map((one) => ({
      what: one.callFrame.functionName === "" ? "(anonymous)" : one.callFrame.functionName,
      share: `${Math.round(((one.hitCount ?? 0) / Math.max(1, ticks)) * 100)}%`,
      where: `${one.callFrame.url.split("/").pop() ?? one.callFrame.url}:${one.callFrame.lineNumber + 1}`
    }))

  console.log(JSON.stringify({ page: PAGE, watchedMs: Math.round(span), samples: ticks, worst }, null, 1))
} finally {
  session.stop()
}
