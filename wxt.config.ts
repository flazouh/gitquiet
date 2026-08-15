import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { defineConfig, type TargetBrowser } from "wxt"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/*
 * The browser a build is read in, spelled the way its own store spells it. The
 * listing summary below names it, and a Firefox reader told this is "in Chrome"
 * has been handed somebody else's page — so the word follows `-b`, and every
 * store gets its own sentence out of one description.
 */
const readIn: Partial<Record<TargetBrowser, string>> = {
  chrome: "Chrome",
  firefox: "Firefox",
  safari: "Safari",
  edge: "Edge"
}

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
  manifest: ({ browser }) => ({
    /*
     * Chrome Web Store search weighs the package name and this short description
     * (the listing summary, ≤132 chars) hardest. Brand alone does not match the
     * queries people type (`github pull request`, `github pr review`). Keep the
     * long store description in the developer dashboard, not here.
     */
    name: "GitQuiet - GitHub Pull Request Review",
    // Toolbar / overflow menus. Store listing keeps the longer `name`.
    short_name: "GitQuiet",
    description: `GitHub pull request review in ${readIn[browser] ?? "your browser"}. See every PR that needs you, waiting, or still running. One screen, sorted by next action.`,
    ...(process.env.EXTENSION_VERSION === undefined
      ? {}
      : { version: process.env.EXTENSION_VERSION }),
    /*
     * Firefox alone wants to be told which add-on this is. Chrome derives an id
     * from the key the store signs with, but Gecko reads it out of the manifest,
     * and `storage.sync` — the display settings a reader carries between
     * machines — has nowhere to sync to without one. Written as an address
     * rather than a UUID because it is a name a person may have to read.
     *
     * 115 is the oldest Firefox that supports all of this: an MV3 event page,
     * and `web_accessible_resources` narrowed to the hosts that may import them.
     */
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: { id: "gitquiet@gitquiet.dev", strict_min_version: "115.0" }
          }
        }
      : {}),
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
     * (scripts/build-screens.ts), the chunk they share, their stylesheets, the
     * diff renderer the two diff screens ask for when a file is opened, and the
     * markdown highlighter a labelled fence asks for, and the mermaid renderer
     * a mermaid fence asks for.
     *
     * A content script may only import an extension file the manifest has published,
     * and only onto the pages that need it. Published as a folder because the shared
     * chunk's name carries a content hash, which changes with the build.
     */
    web_accessible_resources: [
      {
        resources: [
          "diff-engine.js",
          "markdown-highlighter.js",
          "markdown-mermaid.js",
          "screens/*"
        ],
        matches: ["*://github.com/*"]
      }
    ]
  }),
  /*
   * Firefox asks for the sources next to the package, because a reviewer has to
   * rebuild a bundle to see what is in it. What they need is this extension:
   * `src`, the scripts `bun run build` runs, and the lockfile. What they were
   * getting was the whole repository — the desktop app's build folder alone
   * carries a 63 MB `bun` binary, and the zip came to 72 MB of which almost
   * none was readable source.
   *
   * WXT already leaves out `node_modules`, dotfiles, tests and `.output`. These
   * are the rest of the repository that the extension is not built from, plus
   * the chunks under `public` that `bun run build` writes: they are gitignored,
   * they are minified, and a sources zip that carries them is asking a reviewer
   * to read the output twice instead of the input once. `public/icon` stays —
   * those four PNGs are committed, and no script rebuilds them.
   */
  zip: {
    excludeSources: [
      "desktop/**",
      "site/**",
      "video/**",
      "shots/**",
      "*.md",
      "public/*.js",
      "public/screens/**"
    ],
    // Excluded by the `**/.*` default above, and the one dotfile a reviewer
    // needs: it is the bun the lockfile resolves against.
    includeSources: [".bun-version"]
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
