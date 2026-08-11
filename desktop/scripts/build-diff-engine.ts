/**
 * Builds the diff renderer as its own file, loaded only when someone opens one.
 *
 *     bun run engine    (and as part of `bun run dev` and `bun run build`)
 *
 * The same problem the extension has, for a different reason and with the same
 * answer. Electrobun bundles the webview from one entrypoint and inlines every
 * dynamic import into it, so a `import("../../../src/diff/engine")` put Shiki's
 * four hundred grammars into the file the window parses before it draws anything:
 * fourteen megabytes, and a window that took longer to answer than it took to
 * launch.
 *
 * Worse, it was fourteen megabytes of the wrong thing. `src/diff/engine.ts`
 * imports `shiki`, and the extension aliases that to `src/diff/shiki.ts` — the
 * same library minus the grammars nobody writes a pull request in. Electrobun's
 * bundler is a compiled binary that takes no aliases, so the substitution has to
 * happen in a build of our own, and this is it. Vite rather than `Bun.build`
 * because it is the same build the extension already runs, with the same aliases,
 * and two builds of one file that disagree would be a bug waiting to be confusing.
 */

import { fileURLToPath } from "node:url"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

await build({
  configFile: false,
  publicDir: false,
  resolve: {
    alias: [
      { find: /^shiki$/, replacement: here("../../src/diff/shiki.ts") },
      { find: /^shiki\/wasm$/, replacement: here("../../src/diff/shiki-wasm.ts") }
    ]
  },
  build: {
    // Beside the webview's own files, which is where `electrobun.config.ts` copies
    // it into the app from. Not into `build/`: that folder is Electrobun's and it
    // empties it.
    outDir: here("../src/view"),
    emptyOutDir: false,
    target: "chrome120",
    lib: {
      entry: here("../../src/diff/engine.ts"),
      formats: ["es"],
      fileName: () => "diff-engine.js"
    },
    rollupOptions: { output: { codeSplitting: false } }
  },
  logLevel: "warn"
})

console.log("built src/view/diff-engine.js")
