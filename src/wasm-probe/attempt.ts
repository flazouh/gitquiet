/**
 * Whether WebAssembly can be compiled here, and whether a real grammar parses.
 *
 * Plan 009 asks one question in three places — the content script, an offscreen
 * document, and a worker started from one — so the asking is written once and
 * carried to each of them. It touches no DOM and reads no extension API, which
 * is what lets the same file run inside a window and inside a worker.
 *
 * Two modules are compiled rather than one. The eight bytes of `TINY` are a
 * valid empty module and nothing else, so a refusal on those is a policy and
 * cannot be anything else. The grammar is 2.3MB of real Tree-sitter, which is
 * the shape this project would actually ship, and a policy is not the only way
 * that can fail.
 */

import { Effect } from "effect"
import { Language, Parser } from "web-tree-sitter"

/**
 * A valid WebAssembly module carrying nothing: the four magic bytes and the
 * version. Compiling it asks the policy and asks nothing else.
 */
const TINY = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])

/** Where the three files this needs are, handed in rather than worked out. */
export type Where = {
  /** `web-tree-sitter.wasm`, the runtime the grammars are parsed by. */
  readonly runtime: string
  /** `tree-sitter-typescript.wasm`. */
  readonly grammar: string
  /** A real source file, to parse. */
  readonly sample: string
}

/** What happened in one context, all of it reportable and none of it thrown. */
export type Attempt = {
  readonly where: string
  /** `ok`, or the refusal in the browser's own words. */
  readonly tiny: string
  /** `ok`, or why the grammar's bytes would not compile. */
  readonly grammar: string
  /** `ok`, or why the parse did not happen. */
  readonly parse: string
  readonly grammarBytes: number
  readonly runtimeMs: number
  readonly grammarMs: number
  readonly parseMs: number
  readonly sampleBytes: number
  readonly nodes: number
}

/** A thrown thing in one line, keeping the name, which is where the policy speaks. */
const said = (cause: unknown): string => {
  const error = cause as { name?: string; message?: string } | undefined
  if (error?.message !== undefined) return `${error.name ?? "Error"}: ${error.message}`
  return String(cause)
}

/** `ok` where it worked, and the reason where it did not. Never a failure. */
const outcome = <A>(effect: Effect.Effect<A, string>): Effect.Effect<string> =>
  effect.pipe(
    Effect.as("ok"),
    Effect.catch((reason) => Effect.succeed(reason))
  )

const now = Effect.sync(() => performance.now())

const fetched = (url: string): Effect.Effect<ArrayBuffer, string> =>
  Effect.tryPromise({ try: () => fetch(url), catch: said }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({ try: () => response.arrayBuffer(), catch: said })
        : Effect.fail(`HTTP ${response.status} for ${url}`)
    )
  )

const text = (url: string): Effect.Effect<string, string> =>
  Effect.tryPromise({ try: () => fetch(url), catch: said }).pipe(
    Effect.flatMap((response) => Effect.tryPromise({ try: () => response.text(), catch: said }))
  )

/**
 * The whole question, asked once.
 *
 * Each step is allowed to fail into a sentence rather than into a failure,
 * because a context where the first step is refused still has three more
 * answers worth carrying home — most usefully, whether the refusal was the
 * policy or the fetch.
 */
export const attempt = (where: string, at: Where): Effect.Effect<Attempt> =>
  Effect.gen(function* () {
    const tiny = yield* outcome(
      Effect.tryPromise({ try: () => WebAssembly.compile(TINY), catch: said })
    )

    const bytes = yield* fetched(at.grammar).pipe(
      Effect.map((buffer) => new Uint8Array(buffer)),
      Effect.catch(() => Effect.succeed(new Uint8Array()))
    )

    const startedRuntime = yield* now
    const runtime = yield* outcome(
      Effect.tryPromise({
        try: () => Parser.init({ locateFile: () => at.runtime }),
        catch: said
      })
    )
    const readyRuntime = yield* now

    const startedGrammar = yield* now
    const loaded = yield* Effect.tryPromise({
      try: () => Language.load(at.grammar),
      catch: said
    }).pipe(
      Effect.map((language) => ({ language, why: "ok" })),
      // The reason is the whole point of this step. Swallowed, a grammar that
      // will not load is indistinguishable from a policy that will not let it,
      // which is the one distinction plan 009 exists to make.
      Effect.catch((why) => Effect.succeed({ language: null, why }))
    )
    const language = loaded.language
    const readyGrammar = yield* now

    const source = yield* text(at.sample).pipe(Effect.catch(() => Effect.succeed("")))

    const startedParse = yield* now
    const nodes = yield* Effect.try({
      try: () => {
        if (language === null) throw new Error("no grammar")
        const parser = new Parser()
        parser.setLanguage(language)
        const tree = parser.parse(source)
        if (tree === null) throw new Error("the parser answered with no tree")
        const count = tree.rootNode.descendantCount
        tree.delete()
        parser.delete()
        return count
      },
      catch: said
    }).pipe(Effect.catch((reason) => Effect.succeed(reason)))
    const doneParse = yield* now

    return {
      where,
      tiny,
      // The runtime's own failure is the grammar's, where it has one: nothing
      // can load a grammar through a runtime that never started.
      grammar: runtime === "ok" ? loaded.why : runtime,
      parse: typeof nodes === "number" ? "ok" : nodes,
      grammarBytes: bytes.byteLength,
      runtimeMs: Math.round(readyRuntime - startedRuntime),
      grammarMs: Math.round(readyGrammar - startedGrammar),
      parseMs: Math.round(doneParse - startedParse),
      sampleBytes: source.length,
      nodes: typeof nodes === "number" ? nodes : 0
    }
  })
