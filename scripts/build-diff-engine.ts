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
import { build, type InlineConfig } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** `--watch`, which scripts/dev.ts passes and a build never does. */
const watch = process.argv.includes("--watch")

/** What `build` resolves to when `watch` is set: a build that never finishes. */
type Watcher = {
  on: (name: "event", handle: (event: { code: string; error?: Error }) => void) => void
}

const shared = {
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
  logLevel: "warn" as const
} satisfies InlineConfig

// Pierre's worker must be a separate, self-contained extension file. Build it
// before the watched renderer so the first renderer build can always create it.
await build({
  ...shared,
  build: {
    outDir: here("../public"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: here("../node_modules/@pierre/diffs/dist/worker/worker.js"),
      formats: ["es"],
      fileName: () => "diff-worker.js"
    },
    rollupOptions: { output: { codeSplitting: false } }
  }
})

const result = await build({
  ...shared,
  build: {
    outDir: here("../public"),
    emptyOutDir: false,
    target: "chrome120",
    watch: watch ? {} : null,
    lib: {
      entry: here("../src/diff/engine.ts"),
      formats: ["es"],
      fileName: () => "diff-engine.js"
    },
    // One file, so the content script has one thing to fetch and the manifest
    // one thing to expose.
    rollupOptions: { output: { codeSplitting: false } }
  }
})

if (watch) {
  ;(result as unknown as Watcher).on("event", (event) => {
    if (event.code === "END") console.log("built public/diff-engine.js")
    if (event.code === "ERROR")
      console.error(event.error?.message ?? "diff engine build failed")
  })
} else {
  console.log("built public/diff-engine.js and public/diff-worker.js")
}
