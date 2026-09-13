import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import { everyPlace, kept, keyOf, placesFor, worthReading } from "./ledger"
import type { Syntax } from "./syntax"
import { writingsIn } from "./writings"

/**
 * The Ledger, over a handful of files, with the real grammar doing the reading.
 *
 * Small on purpose. What is being tested is what the index does with what a
 * parse answers — a name in two files, a file nothing parses, a file not worth
 * parsing — and none of that gets truer with a thousand files in it.
 */

let outline: (path: string, text: string) => ReturnType<typeof writingsIn>

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm"
  )

  outline = (path, text) => {
    if (!path.endsWith(".ts")) return []
    const parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(text)
    if (tree === null) return []

    const found = writingsIn(tree.rootNode as unknown as Syntax, text)
    tree.delete()
    parser.delete()
    return found
  }
})

const FILES = new Map([
  ["src/one.ts", "export const shape = () => 1\nexport type Held = string\n"],
  ["src/two.ts", "export const shape = () => 2\n"],
  ["README.md", "# Not code\n"],
  ["node_modules/dep/index.ts", "export const shape = () => 3\n"],
  ["dist/bundle.ts", "export const shape = () => 4\n"]
])

describe("what a repository writes down", () => {
  test("holds every name, with the file that writes it", () => {
    const ledger = kept("owner/repo@abc123", FILES, outline)

    expect(placesFor(ledger, "Held").map((place) => place.path)).toEqual(["src/one.ts"])
    expect(placesFor(ledger, "Held")[0]?.writing.kind).toBe("type")
  })

  test("holds a name written in two files as two places, not as one", () => {
    const ledger = kept("owner/repo@abc123", FILES, outline)

    // Which of them a reader meant is not a question this can answer, and
    // answering it anyway is how a Follow lands in the wrong file.
    expect(placesFor(ledger, "shape").map((place) => place.path)).toEqual([
      "src/one.ts",
      "src/two.ts"
    ])
  })

  test("passes over what nobody wrote and what nobody means", () => {
    const ledger = kept("owner/repo@abc123", FILES, outline)
    const where = everyPlace(ledger).map((place) => place.path)

    expect(where).not.toContain("node_modules/dep/index.ts")
    expect(where).not.toContain("dist/bundle.ts")
    expect(where).not.toContain("README.md")
  })

  test("counts what it read and what it passed over, so a screen can say", () => {
    const ledger = kept("owner/repo@abc123", FILES, outline)

    expect(ledger.read).toBe(2)
    expect(ledger.skipped).toBe(3)
    expect(ledger.at).toBe("owner/repo@abc123")
  })

  test("answers nothing for a name the repository does not write", () => {
    expect(placesFor(kept("owner/repo@abc123", FILES, outline), "missing")).toEqual([])
  })
})

describe("which reading of which repository this is", () => {
  test("is the repository and the commit, and never the commit alone", () => {
    // Two repositories warmed at `main` — which is what a branch name standing
    // in for a sha looks like — must not be one key, or the second answers with
    // the first's names. A benchmark over three repositories found exactly that,
    // and was told all three held the same five files.
    expect(keyOf({ owner: "one", repo: "thing" }, "main")).not.toBe(
      keyOf({ owner: "two", repo: "thing" }, "main")
    )
    expect(keyOf({ owner: "one", repo: "thing" }, "main")).toBe("one/thing@main")
  })
})

describe("which files are worth reading at all", () => {
  test("leaves out what was generated, wherever it was generated to", () => {
    expect(worthReading("node_modules/one/index.ts", "x")).toBe(false)
    expect(worthReading("dist/one.ts", "x")).toBe(false)
    expect(worthReading("packages/app/dist/one.ts", "x")).toBe(false)
    expect(worthReading("src/one.min.js", "x")).toBe(false)
  })

  test("leaves out a file too long to be anything but generated", () => {
    expect(worthReading("src/one.ts", "x".repeat(500_000))).toBe(false)
  })

  test("keeps a file whose folder merely reads like a generated one", () => {
    // `distance.ts` is not `dist/`, and a rule written as a substring would
    // have taken it out along with the bundles.
    expect(worthReading("src/distance.ts", "x")).toBe(true)
    expect(worthReading("src/outline.ts", "x")).toBe(true)
  })
})
