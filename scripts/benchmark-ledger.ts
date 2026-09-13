/**
 * What a Ledger costs the second time, and the time after a push.
 *
 *     bun run build && bun scripts/benchmark-ledger.ts
 *
 * The first reading is a fetch, a gunzip and a parse per file. Every reading
 * after it should be neither: the files have the names they had, and what each
 * one says is on disk under that name. This is where that claim is checked,
 * because it is the whole reason for keeping anything.
 *
 * It reads real repositories over the network, so it is not free and is not part
 * of any gate. Run it when the reading, the parsing or the keeping changes.
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

type Warmth = {
  ready: boolean
  read?: number
  skipped?: number
  parsed?: number
  kept?: boolean
  why?: string
}

const session = await withExtension(PAGE, EXTENSION)

const warm = (at: (typeof REPOS)[number]) => `
  chrome.runtime.sendMessage({
    kind: "gitquiet/ledger-warm",
    owner: ${JSON.stringify(at.owner)},
    repo: ${JSON.stringify(at.repo)},
    sha: ${JSON.stringify(at.sha)}
  })
`

const timed = async <A,>(work: () => Promise<A>): Promise<[A, number]> => {
  const started = Date.now()
  const answer = await work()
  return [answer, Date.now() - started]
}

try {
  const rows: Array<Record<string, unknown>> = []

  for (const at of REPOS) {
    const [warmth, first] = await timed(() => session.evaluateInExtension<Warmth>(warm(at)))

    // Again, from this document's own memory.
    const [, held] = await timed(() => session.evaluateInExtension<Warmth>(warm(at)))

    const [names, typed] = await timed(() =>
      session.evaluateInExtension<{
        places?: ReadonlyArray<{ path: string; writing: { name: string; line: number } }>
      }>(`
        chrome.runtime.sendMessage({
          kind: "gitquiet/ledger-names",
          owner: ${JSON.stringify(at.owner)},
          repo: ${JSON.stringify(at.repo)},
          sha: ${JSON.stringify(at.sha)},
          query: "re",
          most: 40
        })
      `)
    )

    /*
     * About a name this repository really writes, rather than one chosen in
     * advance. The first version of this asked every repository about `default`
     * in `index.js` and was answered nothing three times over, which is a
     * measurement of a typo.
     */
    const about = names.places?.[0]
    const [uses, asked] = await timed(() =>
      about === undefined
        ? Promise.resolve({ uses: [], ready: false })
        : session.evaluateInExtension<{ uses?: ReadonlyArray<unknown>; ready?: boolean }>(`
            chrome.runtime.sendMessage({
              kind: "gitquiet/ledger-across",
              owner: ${JSON.stringify(at.owner)},
              repo: ${JSON.stringify(at.repo)},
              sha: ${JSON.stringify(at.sha)},
              name: ${JSON.stringify(about.writing.name)},
              path: ${JSON.stringify(about.path)},
              line: ${about.writing.line},
              most: 200
            })
          `)
    )

    rows.push({
      repository: `${at.owner}/${at.repo}`,
      ready: warmth.ready,
      filesRead: warmth.read ?? 0,
      filesParsed: warmth.parsed ?? 0,
      offDisk: warmth.kept === true,
      firstMs: first,
      heldMs: held,
      aKeystrokeMs: typed,
      usesMs: asked,
      askedAbout: about?.writing.name ?? null,
      usesFound: uses.uses?.length ?? 0,
      namesOffered: names.places?.length ?? 0,
      why: warmth.why ?? null
    })
  }

  /*
   * And again in a second browser, on the same profile.
   *
   * Which is the question keeping a Ledger exists to answer: the document that
   * held it in memory is gone, the archive is not fetched, and the reading is a
   * list of names off disk. Nothing else in this file can tell the difference
   * between a Ledger kept and a Ledger merely still in hand.
   */
  session.stop()
  const second = await withExtension(PAGE, EXTENSION)
  const at = REPOS[2]!
  const [after, cold] = await timed(() => second.evaluateInExtension<Warmth>(warm(at)))
  second.stop()

  rows.push({
    repository: `${at.owner}/${at.repo} (a new browser, same profile)`,
    ready: after.ready,
    filesRead: after.read ?? 0,
    filesParsed: after.parsed ?? 0,
    offDisk: after.kept === true,
    firstMs: cold,
    heldMs: 0,
    aKeystrokeMs: 0,
    usesMs: 0,
    usesFound: 0,
    namesOffered: 0,
    why: after.why ?? null
  })

  console.table(rows)
  console.log(JSON.stringify(rows, null, 2))
} catch (cause) {
  session.stop()
  throw cause
}
