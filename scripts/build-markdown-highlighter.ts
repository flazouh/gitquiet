/**
 * Builds the markdown highlighter as its own file, loaded on the first labelled fence.
 *
 *     bun run build:markdown-highlighter    (and as part of `bun run build`)
 *
 * Same reason as the diff engine: a content script inlines every dynamic import,
 * and Shiki plus even six grammars is too much to put on every page view.
 */

import { fileURLToPath } from "node:url"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const watch = process.argv.includes("--watch")

type Watcher = {
  on: (name: "event", handle: (event: { code: string; error?: Error }) => void) => void
}

const result = await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: here("../public"),
    emptyOutDir: false,
    target: "chrome120",
    watch: watch ? {} : null,
    lib: {
      entry: here("../src/markdown/highlighter.ts"),
      formats: ["es"],
      fileName: () => "markdown-highlighter.js"
    },
    rollupOptions: { output: { codeSplitting: false } }
  },
  logLevel: "warn"
})

if (watch) {
  ;(result as unknown as Watcher).on("event", (event) => {
    if (event.code === "END") console.log("built public/markdown-highlighter.js")
    if (event.code === "ERROR")
      console.error(event.error?.message ?? "markdown highlighter build failed")
  })
} else {
  console.log("built public/markdown-highlighter.js")
}
