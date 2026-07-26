/**
 * Builds the diff renderer as its own file, loaded only when someone opens one.
 *
 *     bun run build:diff-engine    (and as part of `bun run build`)
 *
 * WXT builds each content script into a single file with every dynamic import
 * inlined, which is the right default and the wrong one here: the renderer and
 * its grammars are four and a half megabytes that most page views never need.
 * So it is built beside the extension instead, into `public/`, which WXT copies
 * verbatim into the output and the manifest exposes as a web-accessible
 * resource.
 */

import { fileURLToPath } from "node:url"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

await build({
  configFile: false,
  // Vite would otherwise treat the folder it is writing into as a folder to
  // copy from, and warn about it for the rest of time.
  publicDir: false,
  resolve: {
    // The same substitution the extension makes: Shiki minus the grammars
    // nobody's pull request is written in. See src/diff/shiki.ts.
    alias: [
      { find: /^shiki$/, replacement: here("../src/diff/shiki.ts") },
      { find: /^shiki\/wasm$/, replacement: here("../src/diff/shiki-wasm.ts") }
    ]
  },
  build: {
    outDir: here("../public"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: here("../src/diff/engine.ts"),
      formats: ["es"],
      fileName: () => "diff-engine.js"
    },
    // One file, so the content script has one thing to fetch and the manifest
    // one thing to expose.
    rollupOptions: { output: { codeSplitting: false } }
  },
  logLevel: "warn"
})

console.log("built public/diff-engine.js")
