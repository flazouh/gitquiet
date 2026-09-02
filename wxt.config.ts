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
     * (the listing summary) hardest. The name is the quieter line. The summary
     * names the browser so a Firefox listing does not read as Chrome's.
     *
     * The long description is store/listing-description.txt, submitted with the
     * release, not a dashboard field of its own.
     *
     * One sentence for every store, because two would have let one of them drift.
     * The length that fits all of them is the App Store's (112), and
     * `manifest.test.ts` holds every target to it and says what happened without it.
     */
    name: "GitQuiet - A faster, quieter GitHub",
    // Toolbar / overflow menus. Store listing keeps the longer `name`.
    short_name: "GitQuiet",
    description: `A faster, quieter GitHub in ${readIn[browser] ?? "your browser"}. Every pull request you're in, one screen, sorted by next action.`,
    ...(process.env.RELEASE_VERSION === undefined
      ? {}
      : { version: process.env.RELEASE_VERSION }),
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
            gecko: {
              id: "gitquiet@gitquiet.dev",
              strict_min_version: "115.0",
              /*
               * Nothing is collected, and Firefox refuses a submission that does
               * not say so either way.
               *
               * Mozilla counts anything handled outside the browser, and what
               * leaves here goes to api.github.com carrying the reader's own
               * token, which is the extension being a GitHub client rather than
               * GitHub learning something new. There is no server of ours to
               * send anything to. Sentry is compiled in but a release build
               * carries no DSN, so it initialises nothing and reports nowhere.
               *
               * `none` cannot be combined with a category, so the day any of
               * that stops being true this becomes a list instead.
               */
              data_collection_permissions: { required: ["none"] }
            }
          }
        }
      : {}),
    // `alive.github.com` is the socket GitHub's own page holds open to hear
    // that something changed. A content script's requests are the extension's,
    // not the page's, so listening on it has to be asked for by name.
    // Written `https` rather than `wss`, which Chrome does not accept as a
    // scheme here: permission to a host covers its websocket.
    /*
     * `gist.github.com` is its own host, and a bare `github.com` pattern does not
     * cover a different subdomain — Chrome match patterns are exact on the host
     * unless written with a leading `*.`. Named separately rather than widened to
     * `*://*.github.com/*`, which would also grant every other subdomain GitHub
     * has ever stood up and nobody has asked this extension to run on.
     *
     * See `docs/spec/gists.md`. This page is not `place.ts`'s to gate: it carries
     * no React application and nothing here replaces a region of it, so the only
     * thing this permission is for is `gist.content.ts` appending to the page.
     */
    host_permissions: [
      "*://github.com/*",
      "*://gist.github.com/*",
      "https://alive.github.com/*"
    ],
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
    // `webNavigation` is what tells the worker a tab has started going to a pull
    // request, which is the only moment anything of ours can act on before
    // GitHub's own HTML answers — a wait of 1.2 to 3.6 seconds on a large one,
    // during which no script of ours exists on the page at all. It carries no
    // page content: an address, a tab and a frame. See src/app/onTheWay.ts.
    permissions: [
      "storage",
      "unlimitedStorage",
      "webNavigation",
      ...((browser === "chrome" || browser === "edge") ? ["offscreen"] : [])
    ],
    /*
     * Everything the shell fetches once it knows what page this is: the four screens
     * (scripts/build-screens.ts), the chunk they share, their stylesheets, the
     * diff renderer the two diff screens ask for when a file is opened, and the
     * Mermaid renderer a mermaid fence asks for.
     *
     * A content script may only import an extension file the manifest has published,
     * and only onto the pages that need it. Published as a folder because the shared
     * chunk's name carries a content hash, which changes with the build.
     */
    web_accessible_resources: [
      {
        resources: [
          "diff-engine.js",
          "markdown-mermaid.js",
          "markdown-mermaid-local.js",
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
    /*
     * `{{version}}` is the manifest's, which reads `RELEASE_VERSION` above.
     * `{{packageVersion}}` is package.json's, and package.json here says `0.0.0`
     * on purpose, so WXT's default names every zip of every release
     * `gitquiet-0.0.0-`. The bytes inside are right either way: this is the label
     * on the tin, which is what a release page shows and what a link points at.
     *
     * Otherwise these are WXT's defaults, `{{modeSuffix}}` included. It is empty
     * in production and `-dev` elsewhere, and it is what keeps a development zip
     * from being written over the release one at the same path.
     */
    artifactTemplate: "{{name}}-{{version}}-{{browser}}{{modeSuffix}}.zip",
    sourcesTemplate: "{{name}}-{{version}}-sources{{modeSuffix}}.zip",
    /*
     * The prose stays in. Mozilla asks a reviewer to rebuild the extension from
     * this archive, and refuses one that arrives without instructions, so the
     * README that carries them is the last thing to drop for size.
     *
     * `desktop/*\/**` is every file in every folder under `desktop`, and no file
     * sitting directly in it. Not `desktop/**`, because an exclusion beats an
     * inclusion and `desktop/package.json` has to survive: the root package.json
     * calls `desktop` a workspace, and bun refuses to install a workspace it
     * cannot find. Six small config files stay. 154 MB goes, including the 63 MB
     * `bun` binary under `build`.
     *
     * One pattern rather than a folder each, so a folder added to the desktop app
     * next year is dropped by default instead of shipping until somebody notices
     * the archive is large again.
     */
    excludeSources: [
      "desktop/*/**",
      "site/**",
      "video/**",
      "shots/**",
      "public/*.js",
      "public/screens/**"
    ],
    /*
     * This is an allowlist, not an addition to one: WXT defaults it to `**\/*`
     * and uses whatever is written here instead. So `**\/*` has to be restated
     * before anything can be added to it.
     *
     * `.bun-version` is the bun the lockfile resolves against, and hidden files
     * are dropped unless named. Not `zip.dotSources`, which is the switch for
     * this and takes every dotfile in the repository with it.
     */
    includeSources: ["**/*", ".bun-version"]
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
