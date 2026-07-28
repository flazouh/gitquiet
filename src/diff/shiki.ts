/**
 * Shiki, minus the nine hundred languages nobody's pull request is written in.
 *
 * `@pierre/diffs` imports the `shiki` bundle, whose language map is nearly
 * seven hundred dynamic imports. A content script cannot code-split — the whole
 * thing is inlined into one file — so importing it honestly cost 10.6MB, which
 * is not a diff viewer, it is a download. Measured: 481kB before, 10.64MB
 * after.
 *
 * This module stands in for `shiki` (see the alias in wxt.config.ts) and offers
 * the same five things Pierre reaches for, with a language map holding the ones
 * people actually open a pull request about. Anything else renders as plain
 * text: unhighlighted code is legible, a ten megabyte content script is not.
 *
 * The list is a judgement, not a limit — adding a language here costs its
 * grammar and nothing else. Longer term this moves into the worker Pierre
 * ships, where grammars load off the main thread and the ceiling disappears.
 */

export * from "shiki/core"
export { createJavaScriptRegexEngine } from "shiki/engine/javascript"

import { createHighlighterCore, type HighlighterCore } from "shiki/core"

/**
 * The grammars worth their bytes, in rough order of how often a diff contains
 * them. `text` and `ansi` are Shiki's own specials and are not listed: core
 * already knows them.
 */
export const bundledLanguages = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  yaml: () => import("@shikijs/langs/yaml"),
  markdown: () => import("@shikijs/langs/markdown"),
  css: () => import("@shikijs/langs/css"),
  scss: () => import("@shikijs/langs/scss"),
  html: () => import("@shikijs/langs/html"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  java: () => import("@shikijs/langs/java"),
  ruby: () => import("@shikijs/langs/ruby"),
  php: () => import("@shikijs/langs/php"),
  csharp: () => import("@shikijs/langs/csharp"),
  cpp: () => import("@shikijs/langs/cpp"),
  c: () => import("@shikijs/langs/c"),
  swift: () => import("@shikijs/langs/swift"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  sql: () => import("@shikijs/langs/sql"),
  toml: () => import("@shikijs/langs/toml"),
  xml: () => import("@shikijs/langs/xml"),
  docker: () => import("@shikijs/langs/docker"),
  graphql: () => import("@shikijs/langs/graphql"),
  diff: () => import("@shikijs/langs/diff")
} as const

/**
 * Pierre asks for this with a name-based language list, which core does not
 * take; by the time it does, the only name in the list is `text`, which core
 * handles itself. Every real grammar arrives later through `bundledLanguages`.
 */
export const createHighlighter = (options: {
  readonly themes?: ReadonlyArray<unknown>
  readonly langs?: ReadonlyArray<unknown>
  readonly engine?: unknown
}): Promise<HighlighterCore> =>
  createHighlighterCore({
    ...options,
    themes: [],
    langs: []
  } as Parameters<typeof createHighlighterCore>[0])

/**
 * The WASM engine, declined — and not for its size.
 *
 * Oniguruma is the engine these grammars were written for and it highlights a
 * file in a fraction of the time: measured on a 33-file pull request, 455ms of
 * main-thread work per file opened became 96ms. It cannot be used here. GitHub
 * serves `script-src github.githubassets.com`, a content script's isolated
 * world is held to the page's policy for WebAssembly, and so every compile is
 * refused — silently, inside the highlighter, leaving a diff that renders
 * nothing at all. Declaring `wasm-unsafe-eval` in our own manifest does not
 * change it: the policy that applies is theirs.
 *
 * A worker started from an extension URL is a different origin with a different
 * policy, and is where this goes if the second is ever worth chasing.
 */
export const createOnigurumaEngine = (): never => {
  throw new Error("githubpro highlights with the JavaScript engine; GitHub's CSP refuses WASM")
}
