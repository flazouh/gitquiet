/**
 * What the exact tier costs, on a real repository, in the browser it runs in.
 *
 *     bun run build && bun scripts/benchmark-exact.ts
 *
 * Measured under Bun the same program builds in 975ms and answers in 12 to 40ms.
 * None of that is a promise about a browser: the compiler is nine megabytes of
 * JavaScript fetched over an extension URL, the files come out of an archive
 * rather than a disk, and the document it runs in is also drawing diagrams. This
 * is that, measured where it happens.
 */
import { withExtension } from "./chrome"

const PAGE = "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const REPOS = [
  { owner: "sindresorhus", repo: "ky", sha: "main", name: "retry", path: "source/core/Ky.ts" },
  { owner: "honojs", repo: "hono", sha: "main", name: "Hono", path: "src/hono.ts" }
]

const session = await withExtension(PAGE, EXTENSION)

const timed = async <A,>(work: () => Promise<A>): Promise<[A, number]> => {
  const started = Date.now()
  const answer = await work()
  return [answer, Date.now() - started]
}

try {
  const rows: Array<Record<string, unknown>> = []

  for (const at of REPOS) {
    const [warmth, warmMs] = await timed(() =>
      session.evaluateInExtension<{ ready: boolean; read?: number; why?: string }>(`
        chrome.runtime.sendMessage({
          kind: "gitquiet/ledger-warm",
          owner: ${JSON.stringify(at.owner)},
          repo: ${JSON.stringify(at.repo)},
          sha: ${JSON.stringify(at.sha)},
          exact: true
        })
      `)
    )

    /*
     * The exact tier is built after the answer, on purpose, so it is not ready
     * the moment the warm returns. This waits for it the way a reader would: by
     * asking again until the answer says a compiler gave it.
     */
    const ask = () =>
      session.evaluateInExtension<{ uses?: ReadonlyArray<unknown>; exact?: boolean; ready: boolean }>(`
        chrome.runtime.sendMessage({
          kind: "gitquiet/ledger-across",
          owner: ${JSON.stringify(at.owner)},
          repo: ${JSON.stringify(at.repo)},
          sha: ${JSON.stringify(at.sha)},
          name: ${JSON.stringify(at.name)},
          path: ${JSON.stringify(at.path)},
          line: 1,
          column: 0,
          most: 200
        })
      `)

    const waiting = Date.now()
    let answer = await ask()
    while (answer.exact !== true && Date.now() - waiting < 120_000) {
      await new Promise((go) => setTimeout(go, 500))
      answer = await ask()
    }
    const readyMs = Date.now() - waiting

    const [again, askMs] = await timed(ask)

    rows.push({
      repository: `${at.owner}/${at.repo}`,
      warmMs,
      filesRead: warmth.read ?? 0,
      exactReadyMs: answer.exact === true ? readyMs : null,
      exactAnswered: answer.exact === true,
      aQuestionMs: askMs,
      usesFound: again.uses?.length ?? 0,
      why: warmth.why ?? null
    })
  }

  console.table(rows)
  console.log(JSON.stringify(rows, null, 2))
} finally {
  session.stop()
}
