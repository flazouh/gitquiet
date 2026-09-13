/**
 * Whether Following answers on a live github.com page.
 *
 * `bun run build && bun scripts/probe-ledger.ts`
 *
 * Every part of this is tested without a browser — the resolver against the
 * real grammar under `bun test`, the seam between the renderer and the Ledger
 * with both stood in for. What none of that can answer is whether the three
 * hops work where they have to: a content script that may not compile a grammar,
 * a worker that sleeps, and a document at our own origin that does the parsing.
 *
 * So this asks the Ledger, from the page, about a file of this repository's own,
 * and checks it comes back with the same answers `writings.test.ts` gets.
 */
import { withExtension } from "./chrome"

const PAGE = "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const SOURCE = await Bun.file(`${import.meta.dir}/../fixtures/code/shadowing.ts`).text()

const session = await withExtension(PAGE, EXTENSION)

try {
  const ask = (question: unknown) => `
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-ask",
      path: "shadowing.ts",
      text: ${JSON.stringify(SOURCE)},
      question: ${JSON.stringify(question)}
    })
  `

  // `shape` on the line it is called, which is the outer one.
  const called = SOURCE.split("\n").findIndex((line) => line.startsWith('shape("x")'))
  const outer = await session.evaluateInExtension<{ writing?: { line: number; kind: string } }>(
    ask({ of: "writingAt", at: { row: called, column: 0 } })
  )

  // `shape` inside `said`, which is a different thing with the same spelling.
  const inner = SOURCE.split("\n").findIndex((line) => line.includes("return shape + shape"))
  const shadowed = await session.evaluateInExtension<{ writing?: { line: number } }>(
    ask({ of: "writingAt", at: { row: inner, column: 9 } })
  )

  const outline = await session.evaluateInExtension<{ writings?: ReadonlyArray<{ name: string }> }>(
    ask({ of: "writingsIn" })
  )

  // A name this file borrowed, which is the whole of 012: the answer is not a
  // Writing at all but the file it came from and the name it has there.
  const borrowedAt = SOURCE.split("\n").findIndex((line) => line.includes("return elsewhere("))
  const borrowed = await session.evaluateInExtension<{
    borrowed?: { name: string; specifier: string }
  }>(ask({ of: "writingAt", at: { row: borrowedAt, column: 9 } }))

  // And the other half, asked of the file it names.
  const named = await session.evaluateInExtension<{ writing?: { name: string; line: number } }>(`
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-ask",
      path: "whole.ts",
      text: ${JSON.stringify(await Bun.file(`${import.meta.dir}/../fixtures/code/whole.ts`).text())},
      question: { of: "writingNamed", name: "two" }
    })
  `)

  const plain = await session.evaluateInExtension<{ why?: string }>(`
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-ask",
      path: "notes.txt",
      text: "nothing here is code",
      question: { of: "writingsIn" }
    })
  `)

  /*
   * The Ledger itself: a repository read whole, out of the archive.
   *
   * A small public one, and a branch name where a sha would go — the archive
   * route takes either, and a probe should not have to look a commit up to ask
   * whether the reading works at all.
   */
  const started = Date.now()
  const warmth = await session.evaluateInExtension<{
    ready: boolean
    read?: number
    skipped?: number
    why?: string
  }>(`
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-warm",
      owner: "sindresorhus",
      repo: "p-limit",
      sha: "main"
    })
  `)
  const warmedIn = Date.now() - started

  const names = await session.evaluateInExtension<{
    ready: boolean
    places?: ReadonlyArray<{ path: string; writing: { name: string; line: number } }>
  }>(`
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-names",
      owner: "sindresorhus",
      repo: "p-limit",
      sha: "main",
      query: "limit",
      most: 5
    })
  `)

  console.log(
    JSON.stringify(
      {
        followedTo: outer.writing?.line ?? null,
        followedKind: outer.writing?.kind ?? null,
        shadowedTo: shadowed.writing?.line ?? null,
        outline: outline.writings?.map((one) => one.name) ?? null,
        borrowedFrom: borrowed.borrowed ?? null,
        andWrittenAt: named.writing ?? null,
        aFileNothingParses: plain.why ?? null,
        warmth,
        warmedInMs: warmedIn,
        namesReady: names.ready,
        names: names.places?.map((one) => `${one.writing.name} ${one.path}:${one.writing.line}`) ?? null,
        problems: session.problems().slice(0, 3)
      },
      null,
      2
    )
  )
} finally {
  session.stop()
}
