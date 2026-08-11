import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "wxt"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  /** Everything the extension is built from lives in `src`, entrypoints included. */
  srcDir: "src",
  /*
   * `wxt` would otherwise hand the dev build to web-ext, which asks
   * chrome-launcher for a Chrome to start — and there is none installed here, so
   * dev mode died on "No Chrome installations found" before it could serve
   * anything. The browser we develop against is ego lite, which is already
   * running and already signed in to GitHub, and it takes the build through
   * `Extensions.loadUnpacked` instead: see scripts/ego-dev.js.
   *
   * Turning the runner off costs nothing that matters. The dev server still
   * watches, rebuilds, and tells the loaded extension to reload itself; only the
   * launching of a throwaway browser goes away.
   */
  webExt: { disabled: true },
  manifest: {
    /*
     * Chrome Web Store search weighs the package name and this short description
     * (the listing summary, ≤132 chars) hardest. Brand alone does not match the
     * queries people type (`github pull request`, `github pr review`). Keep the
     * long store description in the developer dashboard, not here.
     */
    name: "GitQuiet - GitHub Pull Request Review",
    // Toolbar / overflow menus. Store listing keeps the longer `name`.
    short_name: "GitQuiet",
    description:
      "GitHub pull request review in Chrome. See every PR that needs you, waiting, or still running. One screen, sorted by next action.",
    ...(process.env.EXTENSION_VERSION === undefined
      ? {}
      : { version: process.env.EXTENSION_VERSION }),
    // `alive.github.com` is the socket GitHub's own page holds open to hear
    // that something changed. A content script's requests are the extension's,
    // not the page's, so listening on it has to be asked for by name.
    // Written `https` rather than `wss`, which Chrome does not accept as a
    // scheme here: permission to a host covers its websocket.
    host_permissions: ["*://github.com/*", "https://alive.github.com/*"],
    // Display settings are kept in `storage.sync`, so a reader who chose
    // side-by-side diffs on one machine has them on the next. Without this the
    // API is simply absent in the content script, and choices last as long as
    // the tab does.
    // `unlimitedStorage` because the pull requests kept ready to open instantly
    // are GitHub's own payloads — around a hundred kilobytes each — and forty of
    // them would sit uncomfortably against the five megabytes `storage.local`
    // otherwise allows.
    // No `scripting`: the worker used to inject an interface on request, because
    // GitHub navigates without loading pages and a content script's matches are
    // never tested again. The shell imports the screen itself now — see
    // src/app/screens.ts — so there is nobody to ask and no permission to hold.
    permissions: ["storage", "unlimitedStorage"],
    /*
     * Everything the shell fetches once it knows what page this is: the four screens
     * (scripts/build-screens.ts), the chunk they share, their stylesheets, and the
     * diff renderer the two diff screens ask for when a file is opened.
     *
     * A content script may only import an extension file the manifest has published,
     * and only onto the pages that need it. Published as a folder because the shared
     * chunk's name carries a content hash, which changes with the build.
     */
    web_accessible_resources: [
      { resources: ["diff-engine.js", "screens/*"], matches: ["*://github.com/*"] }
    ]
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
