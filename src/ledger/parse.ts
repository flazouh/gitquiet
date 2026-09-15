/**
 * The parser, and the one file in this extension that knows what one is.
 *
 * It lives wherever WebAssembly may be compiled, which is our own origin and
 * nowhere else: a content script is held to github.com's policy and refused.
 * See `src/diff/shiki.ts`, where that was learnt about a different compile, and
 * `plans/009-can-a-grammar-compile-at-all.md`, where it was measured about this
 * one.
 *
 * The grammars are `@vscode/tree-sitter-wasm`'s. Not `tree-sitter-wasms`, whose
 * are built against Emscripten's legacy `dylink` section and fail to load with
 * `need dylink section` — which reads like a policy refusing a module and is a
 * version mismatch. Also 40% smaller.
 */

import { Effect } from "effect"
import { Language, Parser, type Tree } from "web-tree-sitter"
import type { Syntax } from "./syntax"

/**
 * The languages with a grammar here, by the extensions people write them in.
 *
 * Three grammars for six extensions. TypeScript and TSX are separate grammars
 * and not one with a flag — `<T>x` is a type assertion in one and an unclosed
 * element in the other, and a file parsed by the wrong one is a file full of
 * errors. JavaScript is its own, and reads `.jsx` as well.
 *
 * It started at one, deliberately: the resolver was going to be written twice
 * before it was written well, and doing that across three languages at once
 * means finding out which third is wrong three times over. It is written now,
 * and what these cost is a `.wasm` each — measured on a repository of sixteen
 * files, of which fifteen were passed over for being JavaScript.
 *
 * The node types the resolver reads are the same in all three: these grammars
 * share their core, and `lexical_declaration` is what a `const` is in each.
 */
const GRAMMARS: Readonly<Record<string, string>> = {
  ts: "tree-sitter-typescript.wasm",
  mts: "tree-sitter-typescript.wasm",
  cts: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  js: "tree-sitter-javascript.wasm",
  mjs: "tree-sitter-javascript.wasm",
  cjs: "tree-sitter-javascript.wasm",
  jsx: "tree-sitter-javascript.wasm"
}

/** Where the grammars and the runtime are, handed in rather than worked out. */
export type Shelf = {
  /** `web-tree-sitter.wasm`, the runtime every grammar is loaded through. */
  readonly runtime: string
  /** One grammar, by the filename {@link GRAMMARS} names. */
  readonly grammar: (file: string) => string
}

/** The grammar a path is written in, or nothing, which is most paths. */
export const grammarFor = (path: string): string | null => {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return null

  // `.d.ts` is TypeScript and its last extension is `ts`, so the plain rule
  // already holds. A name with no dot but for a leading one — `.gitignore` — is
  // not an extension, which is what the `<= 0` above says.
  return GRAMMARS[name.slice(dot + 1).toLowerCase()] ?? null
}

let started: Effect.Effect<void, unknown> | undefined
const loaded = new Map<string, Effect.Effect<Language, unknown>>()

/**
 * The runtime, started once for the life of the document.
 *
 * Kept as the Effect rather than as a flag: two files opened in the same breath
 * both ask, and the second should wait on the first's compile rather than start
 * a second one.
 */
const runtime = (shelf: Shelf): Effect.Effect<void, unknown> => {
  started ??= Effect.tryPromise({
    try: () => Parser.init({ locateFile: () => shelf.runtime }),
    catch: (cause) => cause
  }).pipe(Effect.cached, Effect.runSync)
  return started
}

const grammar = (shelf: Shelf, file: string): Effect.Effect<Language, unknown> => {
  const held = loaded.get(file)
  if (held !== undefined) return held

  const loading = Effect.tryPromise({
    try: () => Language.load(shelf.grammar(file)),
    catch: (cause) => cause
  }).pipe(Effect.cached, Effect.runSync)

  loaded.set(file, loading)
  return loading
}

/**
 * A way to read many files, with the grammar loaded once.
 *
 * {@link parsed} is right for one file and wrong for a repository: it resolves
 * the runtime and the grammar per call, which is cheap because both are cached
 * and is still a promise per file when there are four thousand of them. This
 * resolves them once and hands back something synchronous, which is what
 * building a Ledger wants.
 *
 * The parser and every tree are given back. This is WebAssembly memory, and a
 * build that leaked one tree per file would leak four thousand.
 */
export const reader = <A>(
  shelf: Shelf,
  read: (root: Syntax, text: string) => A
): Effect.Effect<(path: string, text: string) => A | null, unknown> =>
  Effect.gen(function* () {
    yield* runtime(shelf)
    const languages = new Map<string, Language>()

    return (path: string, text: string): A | null => {
      const file = grammarFor(path)
      if (file === null) return null

      const language = languages.get(file) ?? held.get(file) ?? null
      if (language === null) return null

      const parser = new Parser()
      parser.setLanguage(language)
      const tree = parser.parse(text)
      if (tree === null) {
        parser.delete()
        return null
      }

      const found = read(tree.rootNode as unknown as Syntax, text)
      tree.delete()
      parser.delete()
      return found
    }
  })

/**
 * The grammars this document has resolved, for {@link reader} to read
 * synchronously.
 *
 * A second map beside {@link loaded}, which holds the Effects rather than what
 * they resolved to. A synchronous reader cannot wait on an Effect, so the
 * resolved language is kept as it arrives.
 */
const held = new Map<string, Language>()

/** Every grammar this build ships, resolved, so a sweep never has to wait. */
export const ready = (shelf: Shelf): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    yield* runtime(shelf)
    for (const file of new Set(Object.values(GRAMMARS))) {
      const language = yield* grammar(shelf, file)
      held.set(file, language)
    }
  })

/**
 * The trees this document is holding, and the one reason it holds any.
 *
 * A reader holding Command over a file asks about a name, then another, then
 * another — and each of those used to parse the whole file again. Four
 * milliseconds is nothing once and is the difference between an underline that
 * follows the pointer and one that lags behind it.
 *
 * Three, which is a file being read and the two either side of it in a review.
 * Every tree is WebAssembly memory that has to be given back by hand, so what is
 * let go of is deleted rather than dropped: a cache that forgot to would leak a
 * file per hover for the life of a document that outlives every page.
 */
const HOLDING = 3

type Held = { readonly tree: Tree; readonly parser: Parser }

const trees = new Map<string, Held>()

/**
 * A name for a file's contents that costs nothing to work out.
 *
 * Not the blob sha: that is a hash of every byte through SubtleCrypto and a
 * promise, and this is asked on a pointer move. FNV-1a over the text with its
 * length beside it is wrong about two files roughly never, and being wrong
 * costs a stale answer about a file the reader is looking at — which they would
 * see. Being slow costs the underline.
 */
const nameOf = (path: string, text: string): string => {
  let hash = 2_166_136_261
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 16_777_619)
  }
  return `${path}:${text.length}:${hash >>> 0}`
}

const letGo = (key: string): void => {
  const held = trees.get(key)
  if (held === undefined) return

  held.tree.delete()
  held.parser.delete()
  trees.delete(key)
}

/**
 * The runtime and one grammar, loaded before anything is asked.
 *
 * A reader holds Command and waits, once, for a service worker to wake, a
 * document to open, a runtime to compile and a megabyte and a half of grammar to
 * arrive. None of that is a question about a name, and none of it has to happen
 * while they are waiting: a pane that has drawn a file knows which language it
 * is in and can have all of it ready before the key goes down.
 */
export const readyFor = (shelf: Shelf, path: string): Effect.Effect<void, unknown> =>
  Effect.gen(function* () {
    const file = grammarFor(path)
    if (file === null) return

    yield* runtime(shelf)
    const language = yield* grammar(shelf, file)
    held.set(file, language)
  })

/**
 * One file, parsed, or nothing where nothing here speaks its language.
 */
export const parsed = <A>(
  shelf: Shelf,
  path: string,
  text: string,
  read: (root: Syntax) => A
): Effect.Effect<A | null, unknown> =>
  Effect.gen(function* () {
    const file = grammarFor(path)
    if (file === null) return null

    const key = nameOf(path, text)
    const already = trees.get(key)
    if (already !== undefined) {
      // Newest last, so the delete below takes the one asked for longest ago.
      trees.delete(key)
      trees.set(key, already)
      return read(already.tree.rootNode as unknown as Syntax)
    }

    yield* runtime(shelf)
    const language = yield* grammar(shelf, file)

    const parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(text)
    if (tree === null) {
      parser.delete()
      return null
    }

    trees.set(key, { tree, parser })
    while (trees.size > HOLDING) {
      const oldest = trees.keys().next().value
      if (oldest === undefined || oldest === key) break
      letGo(oldest)
    }

    return read(tree.rootNode as unknown as Syntax)
  })
