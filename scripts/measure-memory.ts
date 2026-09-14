/**
 * What a Ledger and a compiler hold, in the document that holds them.
 *
 *     bun run build && bun scripts/measure-memory.ts
 *
 * 170MB was measured under Bun, which is a different heap, a different garbage
 * collector and a machine with no other tabs on it. What a cap should be built
 * from is this number rather than that one — and a cap chosen before measuring
 * would be a number chosen by feel.
 *
 * Read off the offscreen document's own isolate through `Runtime.getHeapUsage`,
 * which is the only honest place to ask: the page's heap knows nothing about a
 * program built in another context.
 */
import { connect, withExtension } from "./chrome"

const PAGE = "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const PORT = process.env["GITQUIET_CDP_PORT"] ?? "9222"

const REPOS = [
  { owner: "sindresorhus", repo: "p-limit", sha: "main" },
  { owner: "sindresorhus", repo: "ky", sha: "main" },
  { owner: "honojs", repo: "hono", sha: "main" }
]

const session = await withExtension(PAGE, EXTENSION)

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

/** The offscreen document's own heap, which is where all of this lives. */
const heapMB = async (): Promise<number | null> => {
  const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
    url: string
    webSocketDebuggerUrl: string
  }>
  const offscreen = targets.find((one) => one.url.endsWith("/offscreen.html"))
  if (offscreen === undefined) return null

  const held = await connect(offscreen.webSocketDebuggerUrl)
  await held.send("Runtime.enable")
  // A collection first: what is wanted is what is held, not what has not been
  // swept yet.
  await held.send("HeapProfiler.enable").catch(() => undefined)
  await held.send("HeapProfiler.collectGarbage").catch(() => undefined)
  const usage = await held.send<{ usedSize: number }>("Runtime.getHeapUsage")
  held.close()
  return Math.round(usage.usedSize / 1e6)
}

try {
  const rows: Array<Record<string, unknown>> = []

  for (const at of REPOS) {
    for (const exact of [false, true]) {
      const ask = () =>
        session.evaluateInExtension<{ read?: number; exactReady?: boolean; why?: string }>(`
          chrome.runtime.sendMessage({
            kind: "gitquiet/ledger-warm",
            owner: ${JSON.stringify(at.owner)},
            repo: ${JSON.stringify(at.repo)},
            sha: ${JSON.stringify(at.sha)},
            exact: ${exact}
          })
        `)

      let warmth = await ask()

      /*
       * Waited for rather than slept through.
       *
       * The tier is built after the answer, so a warm that returns is not a warm
       * that has one — and a fixed sleep measured a compiler that had not
       * finished as a compiler that costs nothing. Twice.
       */
      if (exact) {
        const until = Date.now() + 90_000
        while (warmth.exactReady !== true && Date.now() < until) {
          await sleep(1000)
          warmth = await ask()
        }
      } else {
        await sleep(1000)
      }

      /*
       * A question, before the measurement.
       *
       * `createLanguageService` builds nothing: TypeScript makes the program on
       * the first thing asked of it. Measured before asking, a compiler that had
       * not built anything yet looked exactly like no compiler at all — which is
       * what the first two runs of this reported.
       */
      const asked = await session.evaluateInExtension<{ uses?: ReadonlyArray<unknown> }>(`
        chrome.runtime.sendMessage({
          kind: "gitquiet/ledger-names",
          owner: ${JSON.stringify(at.owner)},
          repo: ${JSON.stringify(at.repo)},
          sha: ${JSON.stringify(at.sha)},
          query: "",
          most: 1
        }).then((names) => {
          const one = names && names.places && names.places[0]
          if (!one) return { uses: [] }
          return chrome.runtime.sendMessage({
            kind: "gitquiet/ledger-across",
            owner: ${JSON.stringify(at.owner)},
            repo: ${JSON.stringify(at.repo)},
            sha: ${JSON.stringify(at.sha)},
            name: one.writing.name,
            path: one.path,
            line: one.writing.line,
            column: one.writing.from - 1,
            most: 200
          })
        })
      `)

      rows.push({
        repository: `${at.owner}/${at.repo}`,
        usesFound: asked.uses?.length ?? 0,
        files: warmth.read ?? 0,
        withCompiler: exact,
        compilerReady: warmth.exactReady === true,
        heldMB: await heapMB(),
        why: warmth.why ?? null
      })
    }
  }

  console.table(rows)
  console.log(JSON.stringify(rows, null, 2))
} finally {
  session.stop()
}
