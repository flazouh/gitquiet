/**
 * What a Ledger costs, on repositories of three sizes.
 *
 *     bun run build && bun scripts/benchmark-ledger.ts
 *
 * `docs/spec/following.md` sets budgets and plan 012 asks for this: the point of
 * the file is to turn them into measurements, including the ones that miss. It
 * reads three real repositories over the network, so it is not free and is not
 * part of any gate — run it when the reading or the parsing changes.
 *
 * Signed out, on a throwaway profile. A private repository would exercise the
 * credentialed half of `archive()` and is not something a probe can assume.
 */
import { withExtension } from "./chrome"

const PAGE = "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

/** Small, medium, large-ish. Nothing enormous: the point is the shape of the curve. */
const REPOS = [
  { owner: "sindresorhus", repo: "p-limit", sha: "main" },
  { owner: "sindresorhus", repo: "ky", sha: "main" },
  { owner: "honojs", repo: "hono", sha: "main" }
]

type Warmth = { ready: boolean; read?: number; skipped?: number; why?: string }

const session = await withExtension(PAGE, EXTENSION)

try {
  const rows: Array<Record<string, unknown>> = []

  for (const at of REPOS) {
    const started = Date.now()
    const warmth = await session.evaluateInExtension<Warmth>(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-warm",
        owner: ${JSON.stringify(at.owner)},
        repo: ${JSON.stringify(at.repo)},
        sha: ${JSON.stringify(at.sha)}
      })
    `)
    const warmed = Date.now() - started

    // Again, which should be the answer already in hand rather than a second read.
    const askedAgain = Date.now()
    await session.evaluateInExtension(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-warm",
        owner: ${JSON.stringify(at.owner)},
        repo: ${JSON.stringify(at.repo)},
        sha: ${JSON.stringify(at.sha)}
      })
    `)
    const again = Date.now() - askedAgain

    const typing = Date.now()
    const names = await session.evaluateInExtension<{ places?: ReadonlyArray<unknown> }>(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-names",
        owner: ${JSON.stringify(at.owner)},
        repo: ${JSON.stringify(at.repo)},
        sha: ${JSON.stringify(at.sha)},
        query: "re",
        most: 40
      })
    `)
    const typed = Date.now() - typing

    rows.push({
      repository: `${at.owner}/${at.repo}`,
      ready: warmth.ready,
      filesRead: warmth.read ?? 0,
      filesSkipped: warmth.skipped ?? 0,
      warmMs: warmed,
      warmAgainMs: again,
      aKeystrokeMs: typed,
      namesOffered: names.places?.length ?? 0,
      why: warmth.why ?? null
    })
  }

  console.table(rows)
  console.log(JSON.stringify(rows, null, 2))
} finally {
  session.stop()
}
