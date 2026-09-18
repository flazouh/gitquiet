import { describe, expect, test } from "bun:test"
import { dialectFor } from "./dialects"
import { GRAMMARS } from "./parse"
import { GO } from "./dialects/go"
import { PYTHON } from "./dialects/python"
import { JAVA } from "./dialects/java"
import { CPP } from "./dialects/cpp"
import { CSHARP } from "./dialects/csharp"
import { PHP } from "./dialects/php"
import { RUBY } from "./dialects/ruby"
import { RUST } from "./dialects/rust"
import { TYPESCRIPT } from "./dialects/typescript"

/**
 * Which vocabulary reads a file, which is the one thing between a grammar and an
 * answer.
 *
 * Worth its own tests because the two halves are chosen apart: `parse.ts` picks
 * a grammar by the same extension and the lists can drift, and a file with a
 * grammar and no vocabulary is one a reader gets nothing on for a reason nobody
 * would find by reading either list alone.
 */

describe("the vocabulary for a path", () => {
  test("reads the three TypeScript grammars with one vocabulary", () => {
    for (const path of ["a.ts", "a.mts", "a.cts", "a.tsx", "a.js", "a.mjs", "a.cjs", "a.jsx"]) {
      expect(dialectFor(path)).toBe(TYPESCRIPT)
    }
  })

  test("reads Python, Go, Rust and Java", () => {
    expect(dialectFor("a.py")).toBe(PYTHON)
    expect(dialectFor("a.pyi")).toBe(PYTHON)
    expect(dialectFor("a.go")).toBe(GO)
    expect(dialectFor("a.rs")).toBe(RUST)
    expect(dialectFor("Box.java")).toBe(JAVA)
    expect(dialectFor("a.rb")).toBe(RUBY)
    expect(dialectFor("a.php")).toBe(PHP)
    expect(dialectFor("Box.cs")).toBe(CSHARP)
    expect(dialectFor("a.cpp")).toBe(CPP)
    expect(dialectFor("a.h")).toBe(CPP)
  })

  test("answers nothing for a language nothing here reads", () => {
    expect(dialectFor("README.md")).toBeNull()
    expect(dialectFor("a.swift")).toBeNull()
    expect(dialectFor("a.kt")).toBeNull()
  })

  test("reads the last dot of the last segment", () => {
    expect(dialectFor("src/ui/Component.test.tsx")).toBe(TYPESCRIPT)
    expect(dialectFor("a.b/c")).toBeNull()
    // A dotfile is not an extension: `.gitignore` is a name, not a `gitignore`
    // file, and reading it as one is how a dotfile gets a grammar it has no
    // business having.
    expect(dialectFor(".gitignore")).toBeNull()
  })

  test("does not care how the extension is cased", () => {
    expect(dialectFor("A.PY")).toBe(PYTHON)
    expect(dialectFor("A.Go")).toBe(GO)
  })
})

describe("the grammar list and the vocabulary list", () => {
  test("name exactly the same extensions", () => {
    // They are two lists picked by the same extension and picked apart. A
    // grammar with no vocabulary parses a file nobody can ask about; a
    // vocabulary with no grammar is a file that never gets a tree. Either is a
    // reader pressing a name and being told nothing, with nothing in the console
    // to say why.
    const parsed = Object.keys(GRAMMARS).sort()
    const read = parsed.filter((extension) => dialectFor(`a.${extension}`) !== null)
    expect(read).toEqual(parsed)
  })
})
