/**
 * Exact answers, from the compiler that knows what a thing is.
 *
 * Everything else in the Ledger reads code the way a very good highlighter
 * does: scopes, and the imports a file states. It is fast, it needs no
 * dependency, and it is exact inside a file and through a stated import. What it
 * cannot do is `thing.method()`, because knowing what `thing` is needs types.
 *
 * This is that, and it is TypeScript's own language service — the one the
 * playground and every editor run. Measured on this repository, 795 files and
 * 161 thousand lines, with nothing but the repository's own files in it:
 *
 *   - building the program once: 975ms
 *   - finding every reference: 40ms, and 12ms asked again
 *   - following a method call to what it is: 7ms
 *   - held while warm: 170MB
 *
 * So exactness costs a second of background work per repository and nothing per
 * question. The tier below it answers in the meantime and never waits for this.
 *
 * `node_modules` is not here — an archive does not carry it — so an import of a
 * dependency resolves to nothing and its types are `any`. Every name the
 * repository writes itself is unaffected, which is every name this navigates.
 */

import ts from "typescript-5"

/** Where something is, in the words the rest of the Ledger uses. */
export type Spot = { readonly path: string; readonly line: number; readonly column: number }

/** Where a name is written, and enough about it to draw a card. */
export type Written = {
  readonly path: string
  readonly line: number
  readonly column: number
  readonly name: string
  /** What the compiler calls it: `method`, `function`, `class`, `property`. */
  readonly kind: string
  /** The line it is written on, for the card. */
  readonly signature: string
}

/** One exact answer about a name. */
export type Exact = {
  /** Where the name at a spot is written, whatever it takes to know. */
  readonly definitionAt: (at: Spot) => Written | null
  /** Everywhere that means it, across the whole repository. */
  readonly usesAt: (at: Spot) => ReadonlyArray<Spot>
  /** How many files the program holds, for a screen that wants to say. */
  readonly files: number
  readonly close: () => void
}

/** Which files this can say anything about. */
export const readable = (path: string): boolean => /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(path)

/**
 * How many files are worth building a program over.
 *
 * Measured in the document this runs in, after a question rather than before —
 * the service builds nothing until it is asked something, so a compiler that had
 * not been asked anything looked exactly like no compiler at all:
 *
 * | Repository | Files | The Ledger | And a compiler |
 * | --- | --- | --- | --- |
 * | `sindresorhus/p-limit` | 5 | 2MB | 31MB |
 * | `sindresorhus/ky` | 84 | 32MB | 47MB |
 * | `honojs/hono` | 386 | 53MB | 91MB |
 *
 * Which is about 29MB for the compiler and its library however small the
 * repository, and about a tenth of a megabyte per file after that. A thousand
 * files is therefore something like a quarter of a gigabyte held in a document
 * a reader never sees and cannot close, and that is where this stops.
 *
 * Above it the tier below answers, as it does for a repository written in a
 * language nothing here compiles. A reader loses the method calls and keeps
 * everything else, which is the same bargain and a better one than a browser
 * tab that will not let go of a gigabyte.
 */
export const MOST_FILES = 1_000

/** A line and a column as an offset into the text, which is what the service wants. */
const offsetOf = (text: string, line: number, column: number): number => {
  let at = 0
  for (let row = 1; row < line; row++) {
    const next = text.indexOf("\n", at)
    if (next === -1) return text.length
    at = next + 1
  }
  return Math.min(at + column, text.length)
}

/** An offset back into a line and a column, which is what a reader wants. */
const spotOf = (text: string, offset: number): { line: number; column: number } => {
  let line = 1
  let start = 0
  for (let at = 0; at < offset && at < text.length; at++) {
    if (text[at] === "\n") {
      line += 1
      start = at + 1
    }
  }
  return { line, column: offset - start }
}

/**
 * A program over a repository's own files, and nothing it cannot see.
 *
 * The host answers from the map and from nowhere else: there is no disk here,
 * and a host that reached for one would work in a test and fail in the document
 * this runs in.
 */
export const exactly = (
  files: ReadonlyMap<string, string>,
  libs: ReadonlyMap<string, string>
): Exact => {
  const held = new Map<string, string>([...files, ...libs])
  const names = [...files.keys()].filter(readable)

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    // Off, all of it. Nothing here is being checked — the questions are where a
    // name is written and who uses it, and every second spent proving a type is
    // sound is a second the reader waits for an answer that does not need it.
    strict: false,
    skipLibCheck: true,
    noEmit: true,
    noResolve: false,
    types: []
  }

  const lib = [...libs.keys()].find((name) => name.endsWith("lib.es2022.full.d.ts")) ??
    [...libs.keys()][0] ??
    "lib.d.ts"

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => names,
    getScriptVersion: () => "1",
    getScriptSnapshot: (name) => {
      const text = held.get(name)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => options,
    getDefaultLibFileName: () => lib,
    fileExists: (name) => held.has(name),
    readFile: (name) => held.get(name),
    directoryExists: (name) => {
      const within = name.endsWith("/") ? name : `${name}/`
      for (const path of held.keys()) if (path.startsWith(within)) return true
      return false
    },
    getDirectories: () => []
  }

  const service = ts.createLanguageService(host, ts.createDocumentRegistry())

  const textOf = (path: string): string | null => held.get(path) ?? null

  return {
    definitionAt: (at) => {
      const text = textOf(at.path)
      if (text === null) return null

      const found = service.getDefinitionAtPosition(at.path, offsetOf(text, at.line, at.column))
      const first = found?.[0]
      if (first === undefined) return null

      const into = textOf(first.fileName)
      if (into === null) return null

      const where = spotOf(into, first.textSpan.start)
      return {
        path: first.fileName,
        line: where.line,
        column: where.column,
        // The compiler's own words for what it found. It knows the name of the
        // thing it resolved to, which is not always the name that was clicked:
        // an alias, a default export, a re-export.
        name: first.name,
        kind: String(first.kind),
        signature: (into.split("\n")[where.line - 1] ?? "").trim()
      }
    },

    usesAt: (at) => {
      const text = textOf(at.path)
      if (text === null) return []

      const found = service.findReferences(at.path, offsetOf(text, at.line, at.column))
      if (found === undefined) return []

      const uses: Array<Spot> = []
      for (const one of found) {
        for (const reference of one.references) {
          const into = textOf(reference.fileName)
          if (into === null) continue
          const where = spotOf(into, reference.textSpan.start)
          uses.push({ path: reference.fileName, line: where.line, column: where.column })
        }
      }
      return uses
    },

    files: names.length,
    close: () => service.dispose()
  }
}
