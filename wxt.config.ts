import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "wxt"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  /** Everything the extension is built from lives in `src`, entrypoints included. */
  srcDir: "src",
  manifest: {
    name: "githubpro",
    description:
      "Replaces a pull request's conversation with a view organised by whose move it is.",
    host_permissions: ["*://github.com/*"],
    // Court corrections are kept in extension storage. Without this the API is
    // simply absent in the content script, and since a store we cannot read is
    // treated as empty, every correction is lost with nothing said about it.
    permissions: ["storage"],
    // The diff renderer is built beside the extension rather than into the
    // content script (scripts/build-diff-engine.ts) and imported the first time
    // someone opens a file. A content script may only import an extension file
    // the manifest has published, and only onto the pages that need it.
    web_accessible_resources: [{ resources: ["diff-engine.js"], matches: ["*://github.com/*"] }]
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        // `@pierre/diffs` imports the full Shiki bundle, and a content script is
        // one file, so "lazily imported grammar" means "shipped grammar" — all
        // seven hundred of them. src/diff/shiki.ts offers the same surface with
        // the languages diffs are actually written in. Anchored patterns, so
        // that `shiki/core` and `shiki/engine/javascript` still reach Shiki.
        { find: /^shiki$/, replacement: here("src/diff/shiki.ts") },
        { find: /^shiki\/wasm$/, replacement: here("src/diff/shiki-wasm.ts") }
      ]
    }
  })
})
