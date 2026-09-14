/**
 * Builds what has to be built beside the extension rather than into it: the
 * Ledger's parser and its grammars, and the compiler behind the exact tier.
 *
 *     bun scripts/build-ledger.ts    (and as part of `bun run build`)
 *
 * The grammars are files rather than imports. A content script inlines every
 * dynamic import into one file — the finding that cost 10.6MB once already, see
 * `src/diff/shiki.ts` — and a grammar is a megabyte and a half a reader who
 * never holds Command must not download. So they are copied into `public/`,
 * which WXT copies verbatim, and fetched by name at our own origin.
 *
 * The compiler is bundled the way the diff renderer is — vite in library mode,
 * into `public/` — because the document that uses it imports it from an
 * extension URL, and `typescript-5` is a bare import that has to be resolved
 * before then.
 */

import { fileURLToPath } from "node:url"
import { mkdir } from "node:fs/promises"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

await mkdir(here("../public/ledger"), { recursive: true })
await mkdir(here("../public/exact"), { recursive: true })

/*
 * The exact tier, built beside the extension and never into it.
 *
 * TypeScript's own language service is nine megabytes of JavaScript. It is what
 * makes `thing.method()` answerable at all, and it is not something a reader who
 * never asks for it should carry into a content script — which inlines every
 * dynamic import into one file. So it is a chunk of its own, fetched by the
 * offscreen document the first time a repository is read exactly.
 */
await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: here("../public"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: here("../src/ledger/exact.ts"),
      formats: ["es"],
      fileName: () => "exact.js"
    },
    rollupOptions: { output: { codeSplitting: false } }
  },
  logLevel: "warn"
})

/**
 * The standard library the program is built against.
 *
 * Two and a half megabytes of `.d.ts`, and without them nothing resolves: every
 * `string`, every `Promise`, every `Array` is a name the compiler has never
 * heard of. Copied rather than bundled, because they are read as files by a host
 * that answers from a map.
 */
const libs = new Bun.Glob("lib.*.d.ts")
let libBytes = 0
for (const name of libs.scanSync({ cwd: here("../node_modules/typescript-5/lib") })) {
  const file = Bun.file(here(`../node_modules/typescript-5/lib/${name}`))
  await Bun.write(here(`../public/exact/${name}`), file)
  libBytes += file.size
}
/*
 * And a list of them, because the document that reads them has no folder to
 * look in. A `.d.ts` the program asks for and cannot find is every `string` and
 * every `Promise` becoming a name the compiler has never heard of.
 */
const names = [...new Bun.Glob("lib.*.d.ts").scanSync({ cwd: here("../public/exact") })].sort()
await Bun.write(here("../public/exact/libs.json"), JSON.stringify(names))
console.log(`exact/lib.*.d.ts  ${names.length} files, ${libBytes} bytes`)

/**
 * The runtime, the grammar and something real to parse.
 *
 * The sample is this repository's own `place.ts` rather than a snippet: the
 * question is what a file somebody actually opens costs, and a ten-line example
 * would answer a question nobody asked.
 */
/**
 * The Ledger's own, which ship. One language, which is plan 011's whole scope.
 *
 * `@vscode/tree-sitter-wasm` rather than `tree-sitter-wasms`, and the difference
 * is not taste. A grammar is a WebAssembly side module naming its imports in a
 * `dylink` custom section; Emscripten renamed that section to `dylink.0` years
 * ago, and the loader in web-tree-sitter 0.27 reads only the new name.
 * `tree-sitter-wasms@0.1.13` still ships the old one, so every grammar in it
 * fails to load with `need dylink section` — which reads as a policy refusing a
 * module and is nothing of the kind. These are `dylink.0`, and 40% smaller
 * besides: 1.41MB against 2.34MB for TypeScript.
 */
const LEDGER: ReadonlyArray<readonly [string, string]> = [
  ["../node_modules/web-tree-sitter/web-tree-sitter.wasm", "web-tree-sitter.wasm"],
  [
    "../node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm",
    "tree-sitter-typescript.wasm"
  ],
  ["../node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm", "tree-sitter-tsx.wasm"],
  [
    "../node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm",
    "tree-sitter-javascript.wasm"
  ]
]

for (const [from, to] of LEDGER) {
  const file = Bun.file(here(from))
  await Bun.write(here(`../public/ledger/${to}`), file)
  console.log(`ledger/${to}  ${file.size} bytes`)
}

