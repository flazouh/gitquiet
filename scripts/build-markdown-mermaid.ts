/**
 * Builds the mermaid renderer as its own file, loaded on the first mermaid fence.
 *
 *     bun run build:markdown-mermaid    (and as part of `bun run build`)
 *
 * Same reason as the highlighter: a content script inlines every dynamic import,
 * and mermaid is too much to put on every page view.
 */

import { fileURLToPath } from "node:url"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const watch = process.argv.includes("--watch")

type Watcher = {
  on: (name: "event", handle: (event: { code: string; error?: Error }) => void) => void
}

const bundle = (entry: string, file: string) =>
  build({
    configFile: false,
    publicDir: false,
    build: {
      outDir: here("../public"),
      emptyOutDir: false,
      target: "chrome120",
      watch: watch ? {} : null,
      lib: {
        entry: here(entry),
        formats: ["es"],
        fileName: () => file
      },
      rollupOptions: { output: { codeSplitting: false } }
    },
    logLevel: "warn"
  })

const results = await Promise.all([
  bundle("../src/markdown/mermaidClient.ts", "markdown-mermaid.js"),
  bundle("../src/markdown/mermaidChunk.ts", "markdown-mermaid-local.js")
])

if (watch) {
  for (const result of results) {
    ;(result as unknown as Watcher).on("event", (event) => {
      if (event.code === "END") console.log("built Mermaid chunks")
      if (event.code === "ERROR") console.error(event.error?.message ?? "mermaid build failed")
    })
  }
} else {
  console.log("built Mermaid client and local renderer")
}
