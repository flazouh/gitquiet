/**
 * Builds the markdown highlighter as its own file, loaded on the first labelled fence.
 *
 *     bun run highlighter    (and as part of `bun run css`)
 *
 * Same reason as the diff engine: Electrobun inlines every dynamic import into
 * the webview entry, and Shiki plus six grammars should not be parsed before
 * the window draws a list.
 */

import { fileURLToPath } from "node:url"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: here("../src/view"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: here("../../src/markdown/highlighter.ts"),
      formats: ["es"],
      fileName: () => "markdown-highlighter.js"
    },
    rollupOptions: { output: { codeSplitting: false } }
  },
  logLevel: "warn"
})

console.log("built src/view/markdown-highlighter.js")
