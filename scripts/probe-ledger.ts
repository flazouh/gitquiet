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
import { reachingAll } from "../src/ledger/reaching"
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

  /*
   * A name borrowed from a package rather than from a path, which resolves
   * against a folder no archive carries. Where it resolves is a repository.
   */
  const beyond = await session.evaluateInExtension<{
    owner?: string
    repo?: string
    path?: string
    line?: number
    why?: string
  }>(`
    chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-warm",
      owner: "sindresorhus",
      repo: "p-limit",
      sha: "main"
    }).then(() => chrome.runtime.sendMessage({
      kind: "gitquiet/ledger-beyond",
      owner: "sindresorhus",
      repo: "p-limit",
      sha: "main",
      specifier: "yocto-queue",
      name: "Queue"
    }))
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
   * Every other language, through the same three hops.
   *
   * `bun test` proves each vocabulary against its grammar on this machine. What
   * it cannot prove is that the grammar compiles in the offscreen document, that
   * the right one is chosen for the extension a file is written under, and that
   * the answer survives the message round trip — which is the whole reason this
   * file exists, and was true of one language until there were ten.
   *
   * Each row presses a name that is written somewhere else in its own fixture,
   * so a wrong answer is a wrong line rather than an empty one.
   */
  const ELSEWHERE: ReadonlyArray<{
    readonly language: string
    readonly path: string
    readonly holds: string
    readonly word: string
    readonly wrote: string
  }> = [
    { language: "python", path: "shadowing.py", holds: "return area(n, self.size)", word: "area", wrote: "def area(" },
    { language: "go", path: "shadowing.go", holds: "return Area(n, b.Size)", word: "Area", wrote: "func Area(shape int" },
    { language: "rust", path: "shadowing.rs", holds: "area(n) + self.size", word: "area", wrote: "fn area(shape: i32)" },
    { language: "java", path: "Shadowing.java", holds: "total += risky()", word: "risky", wrote: "private int risky()" },
    { language: "ruby", path: "shadowing.rb", holds: "total += risky", word: "risky", wrote: "def risky" },
    { language: "php", path: "shadowing.php", holds: "total += risky()", word: "risky", wrote: "function risky()" },
    { language: "c#", path: "Shadowing.cs", holds: "total += Risky()", word: "Risky", wrote: "private int Risky()" },
    { language: "c++", path: "shadowing.cpp", holds: "total += risky()", word: "risky", wrote: "int risky()" }
  ]

  const elsewhere: Record<string, string> = {}
  for (const one of ELSEWHERE) {
    const text = await Bun.file(`${import.meta.dir}/../fixtures/code/${one.path}`).text()
    const lines = text.split("\n")
    const row = lines.findIndex((line) => line.includes(one.holds))
    const wrote = lines.findIndex((line) => line.includes(one.wrote))
    if (row === -1 || wrote === -1) {
      elsewhere[one.language] = `the fixture no longer holds ${row === -1 ? one.holds : one.wrote}`
      continue
    }
    const column = lines[row]!.indexOf(one.word)
    const answer = await session.evaluateInExtension<{
      writing?: { line: number; kind: string }
      why?: string
    }>(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-ask",
        path: ${JSON.stringify(one.path)},
        text: ${JSON.stringify(text)},
        question: ${JSON.stringify({ of: "writingAt", at: { row, column } })}
      })
    `)
    const want = wrote + 1
    const got = answer.writing?.line ?? null
    elsewhere[one.language] =
      got === want ? `ok, ${one.word} at ${got}` : `WRONG: wanted ${want}, got ${got ?? answer.why ?? "nothing"}`
  }

  /*
   * Following a name out of the file it is read in, in the languages that name
   * another file their own way.
   *
   * The three hops again, and one more: the resolver says the name came from
   * elsewhere, `reaching` turns what the file said into a path, and the file at
   * that path is asked what it writes under the name. `bun test` holds each on
   * this machine; what it cannot hold is that the offscreen document answers the
   * same way about a file it was handed over a message.
   */
  const ACROSS: ReadonlyArray<{
    readonly language: string
    readonly from: string
    readonly press: string
    readonly files: Readonly<Record<string, string>>
    readonly wrote: string
    readonly at: number
  }> = [
    {
      language: "java",
      from: "src/main/java/com/ex/Main.java",
      press: "Box",
      wrote: "src/main/java/com/ex/shapes/Box.java",
      at: 2,
      files: {
        "src/main/java/com/ex/Main.java":
          "package com.ex;\nimport com.ex.shapes.Box;\nclass Main { int go() { return new Box(1).size(); } }\n",
        "src/main/java/com/ex/shapes/Box.java":
          "package com.ex.shapes;\npublic class Box { public Box(int n) {} public int size() { return 1; } }\n"
      }
    },
    {
      language: "php",
      from: "src/Main.php",
      press: "Thing",
      wrote: "src/Other/Thing.php",
      at: 3,
      files: {
        "src/Main.php":
          "<?php\nnamespace App;\nuse App\\Other\\Thing;\nfunction go() { return new Thing(); }\n",
        "src/Other/Thing.php": "<?php\nnamespace App\\Other;\nclass Thing { }\n"
      }
    },
    {
      language: "c#",
      from: "src/Main.cs",
      press: "Widget",
      wrote: "src/Other/Thing.cs",
      at: 1,
      files: {
        "src/Main.cs": "using Widget = App.Other.Thing;\nclass Main { Widget w; }\n",
        "src/Other/Thing.cs": "namespace App.Other { public class Thing { } }\n"
      }
    },
    {
      language: "ruby",
      from: "app/main.rb",
      press: "Helper",
      wrote: "app/helper.rb",
      at: 1,
      files: {
        "app/main.rb":
          "require_relative 'helper'\n\nclass Main\n  def go\n    Helper.new\n  end\nend\n",
        "app/helper.rb": "class Helper\nend\n"
      }
    },
    {
      language: "c++",
      from: "src/main.cpp",
      press: "helper",
      wrote: "src/helper.h",
      at: 1,
      files: {
        "src/main.cpp": "#include \"helper.h\"\n\nint main() { return helper(); }\n",
        "src/helper.h": "inline int helper() { return 1; }\n"
      }
    }
  ]

  const across_: Record<string, string> = {}
  for (const one of ACROSS) {
    const text = one.files[one.from]!
    const lines = text.split("\n")
    let row = -1
    let column = -1
    for (let at = lines.length - 1; at > 0 && row === -1; at--) {
      const found = lines[at]!.lastIndexOf(one.press)
      if (found !== -1) {
        row = at
        column = found
      }
    }

    const said = await session.evaluateInExtension<{
      borrowed?: { name: string; specifier: string }
      orFrom?: ReadonlyArray<{ name: string; specifier: string }>
    }>(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-ask",
        path: ${JSON.stringify(one.from)},
        text: ${JSON.stringify(text)},
        question: ${JSON.stringify({ of: "writingAt", at: { row, column } })}
      })
    `)

    if (said.borrowed === undefined) {
      across_[one.language] = "the press said nothing was borrowed"
      continue
    }

    const paths = new Set(Object.keys(one.files))
    const where = [said.borrowed, ...(said.orFrom ?? [])].flatMap((from) =>
      reachingAll(one.from, from.specifier, paths, from.name)
    )
    if (!where.includes(one.wrote)) {
      across_[one.language] = `reached [${where.join(", ")}] and not ${one.wrote}`
      continue
    }

    const written = await session.evaluateInExtension<{ writing?: { line: number } }>(`
      chrome.runtime.sendMessage({
        kind: "gitquiet/ledger-ask",
        path: ${JSON.stringify(one.wrote)},
        text: ${JSON.stringify(one.files[one.wrote]!)},
        question: ${JSON.stringify({ of: "writingNamed", name: "" })}
      })
    `.replace('"name":""', `"name":${JSON.stringify(said.borrowed.name)}`))

    const got = written.writing?.line ?? null
    across_[one.language] =
      got === one.at ? `ok, ${said.borrowed.name} at ${one.wrote}:${got}` : `WRONG: wanted ${one.at}, got ${got}`
  }

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
        beyondTheRepository: beyond,
        aFileNothingParses: plain.why ?? null,
        elsewhere,
        across: across_,
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
