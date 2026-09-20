import { beforeAll, describe, expect, test } from "bun:test"
import { Language, Parser } from "web-tree-sitter"
import type { Syntax } from "../syntax"
import { toldBy, usesIn, writingAt, writingsIn, type Writing } from "../writings"
import { CSHARP } from "./csharp"

/**
 * The C# vocabulary, against the real C# grammar.
 *
 * Block-scoped and bare-calling, as Java is. What earns this file is how much of
 * C# is a declaration wrapping a declaration: a field and a local are both a
 * `variable_declaration` holding a `variable_declarator`, a `for`'s initialiser
 * is that declaration with no statement around it, and a member written with
 * `=>` has a body that is not a block at all.
 */

const SOURCE = await Bun.file("fixtures/code/Shadowing.cs").text()
const lines = SOURCE.split("\n")

let root: Syntax

beforeAll(async () => {
  await Parser.init({ locateFile: () => "node_modules/web-tree-sitter/web-tree-sitter.wasm" })
  const language = await Language.load(
    "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-c-sharp.wasm"
  )
  const parser = new Parser()
  parser.setLanguage(language)
  // Parsed once, and the parser freed the moment it has done its work: it is
  // WebAssembly memory rather than the kind a garbage collector takes back, and
  // eleven grammars' worth of it held across `bun test --parallel` workers is a
  // segmentation fault rather than a failure. The tree stays, because the nodes
  // every test below reads belong to it.
  const tree = parser.parse(SOURCE)!
  parser.delete()
  root = tree.rootNode as unknown as Syntax
})

/** The one-based line that holds a piece of text. */
const lineWith = (holds: string): number => {
  const at = lines.findIndex((line) => line.includes(holds))
  if (at === -1) throw new Error(`no line holds ${holds}`)
  return at + 1
}

/** Where a press lands, given the line to press on and the word to press. */
const pressed = (holds: string, word: string, from = 0): number | null => {
  const line = lineWith(holds)
  const column = lines[line - 1]!.indexOf(word, from)
  if (column === -1) throw new Error(`${word} is not on the line holding ${holds}`)
  const found = writingAt(root, SOURCE, { row: line - 1, column }, CSHARP)
  return found === null || found.at !== "here" ? null : found.writing.line
}

describe("a bare name in a C# file", () => {
  test("a call reaches the method of the type it is in", () => {
    expect(pressed("total += Risky()", "Risky")).toBe(lineWith("private int Risky()"))
  })

  test("a bare name reaches a field of the type it is in", () => {
    expect(pressed("var total = n * size", "size", 20)).toBe(lineWith("private int size"))
  })

  test("a member written with `=>` still reaches what it names", () => {
    expect(pressed("private int Risky() => Limit", "Limit")).toBe(
      lineWith("public const int Limit")
    )
  })
})

describe("a declaration wrapping a declaration", () => {
  test("a local is found from below", () => {
    expect(pressed("return total + doubled", "total")).toBe(lineWith("var total = n * size"))
  })

  test("a `for` initialiser binds, though nothing wraps it", () => {
    // `for (int i = 0; ...)` holds a bare `variable_declaration` with no
    // statement around it. Bound by the statement case alone, the counter could
    // not be pressed anywhere in the loop.
    const loop = lineWith("total += i;")
    const body = lines[loop - 1]!.indexOf("+= i") + 3
    expect(pressed("total += i;", "i", body)).toBe(loop)
  })

  test("a `foreach` binds the name in its header", () => {
    expect(pressed("total += row", "row")).toBe(lineWith("foreach (var row in Rows())"))
  })

  test("a `catch` binds what it caught", () => {
    const caught = lineWith("catch (Exception err)")
    const found = writingAt(
      root,
      SOURCE,
      { row: caught - 1, column: lines[caught - 1]!.indexOf("err") },
      CSHARP
    )
    expect(found?.at).toBe("here")
  })

  test("a generic parameter is the method's own name for a type", () => {
    expect(pressed("public T Pick<T>", "T", 20)).toBe(lineWith("public T Pick<T>"))
  })
})

describe("the outline of a C# file", () => {
  const outline = (): ReadonlyArray<Writing> => writingsIn(root, SOURCE, CSHARP)

  test("offers a class, an interface, an enum, a record and a struct", () => {
    // Found by name and kind together, because a class and its constructor are
    // written under the same name and both are offered.
    const named = (name: string, kind: string): Writing | undefined =>
      outline().find((writing) => writing.name === name && writing.kind === kind)
    expect(named("Box", "class")?.line).toBe(lineWith("public class Box"))
    expect(named("IShape", "type")).toBeDefined()
    expect(named("Kind", "type")).toBeDefined()
    expect(named("Point", "class")).toBeDefined()
    expect(named("Small", "class")).toBeDefined()
  })

  test("offers methods, fields, properties and enum members as members", () => {
    const members = outline().filter((writing) => writing.kind === "member")
    expect(members.map((writing) => writing.name)).toEqual(
      expect.arrayContaining(["size", "Limit", "Size", "Draw", "Risky", "Round", "Square"])
    )
  })

  test("does not offer a local or a parameter", () => {
    const names = outline().map((writing) => writing.name)
    expect(names).not.toContain("total")
    expect(names).not.toContain("doubled")
  })
})

describe("what a C# file borrowed", () => {
  test("an aliased using binds the alias and says what it stands for", () => {
    const told = toldBy(root, SOURCE, CSHARP)
    expect(told.declares).toContain("Widget")
    expect(told.borrows).toContainEqual({ name: "Thing", specifier: "App.Other" })
  })

  test("a plain using names nothing, because it opens a namespace", () => {
    // `using System;` brings in every name that namespace holds and names none
    // of them, so there is nothing a reader can press and nothing to record.
    const said = toldBy(root, SOURCE, CSHARP).borrows.map((one) => one.specifier)
    expect(said).not.toContain("System")
  })
})

describe("every use of one C# name", () => {
  test("counts the writing and the bare call", () => {
    const risky = writingsIn(root, SOURCE, CSHARP).find((writing) => writing.name === "Risky")!
    const uses = usesIn(root, SOURCE, risky, CSHARP).map((use) => use.line)
    expect(uses).toContain(lineWith("private int Risky()"))
    expect(uses).toContain(lineWith("total += Risky()"))
  })
})
