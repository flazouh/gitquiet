/**
 * Builds each screen as its own file, fetched the first time a reader opens one.
 *
 *     bun run build:screens    (and as part of `bun run build`)
 *
 * Why they are not content scripts any more: a content script is only started
 * when a document loads that matches it, and GitHub does not load documents. Every
 * press of a pull request, of their "Pull requests" nav, of a repository's own tab
 * is a soft navigation — so the script for the page arrived at was never started,
 * and the only way to put one there was to ask the worker to inject it. That ask
 * costs whatever the worker takes to wake, which was measured at 587 milliseconds
 * of GitHub's own list on the screen with a cold worker, and is the flakiest thing
 * about this extension.
 *
 * A module can be imported instead. The shell runs on every GitHub page, decides
 * what the address is, and fetches the screen for it by extension URL — no worker,
 * no message, no waiting for either. That is what these files are for, and it is
 * the same arrangement the diff renderer has used all along.
 *
 * One build with five entries rather than five builds, so that React, Effect and
 * everything in `src/ui` are one shared chunk between them instead of five copies.
 * A reader who opens a pull request and then a list pays for the second screen and
 * nothing underneath it.
 */

import { rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { build } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Where the manifest publishes them, and what the shell asks for by name. */
const OUT = here("../public/screens")

/**
 * `--watch`, which scripts/dev.ts passes and a build never does. It rebuilds on
 * save and keeps running, and it stops putting a hash in the shared chunks'
 * names.
 *
 * The hashes are what the wholesale delete below is for, and in a build they are
 * right. Under `wxt`, they are the reason a change to a screen never arrived:
 * the dev server copies `public/` into the output file by file as it sees each
 * one change, and a chunk that changed its name is not a file it was watching —
 * so `working-set.js` landed pointing at a chunk that had never been copied.
 * Stable names are overwritten in place, which the copy does follow.
 */
const watch = process.argv.includes("--watch")

// Wholesale, unlike the diff renderer beside it: the names of the shared chunks
// carry hashes, so a build left on top of the last one leaves the ones nobody
// imports any more behind for good.
rmSync(OUT, { recursive: true, force: true })

/** What `build` resolves to when `watch` is set: a build that never finishes. */
type Watcher = {
  on: (name: "event", handle: (event: { code: string; error?: Error }) => void) => void
}

const result = await build({
  configFile: false,
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: here("../src/$1") },
      // The same substitution the extension makes: Shiki minus the grammars
      // nobody's pull request is written in. See src/diff/shiki.ts.
      { find: /^shiki$/, replacement: here("../src/diff/shiki.ts") },
      { find: /^shiki\/wasm$/, replacement: here("../src/diff/shiki-wasm.ts") }
    ]
  },
  define: {
    // React reads it, and outside WXT's own build nothing has said what it is.
    "process.env.NODE_ENV": '"production"'
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    target: "chrome120",
    watch: watch ? {} : null,
    // Left readable on purpose while this is new: a screen that throws inside a
    // reader's page is one this has to be able to read a stack trace from.
    // Unminified while watching, where the only thing asked of a rebuild is that
    // it be quick — and no source maps, which is not the saving it sounds like:
    // Shiki and Tailwind put eleven megabytes of them in the shared chunk alone,
    // and every one is copied again each time anything is saved.
    minify: !watch,
    rollupOptions: {
      /*
       * Keep what each screen exports, which is the whole point of building them.
       *
       * Vite's default for a build with named inputs is an application's: the entry
       * is something the browser runs, so its exports are of no interest and are
       * dropped. These are modules the shell imports and calls `start` on — dropped,
       * they are five files that run half of themselves at import and offer nothing.
       */
      preserveEntrySignatures: "exports-only",
      input: {
        "pull-request": here("../src/screens/pullRequest.tsx"),
        commit: here("../src/screens/commit.tsx"),
        commits: here("../src/screens/commits.tsx"),
        "working-set": here("../src/screens/workingSet.tsx"),
        "repo-pulls": here("../src/screens/repoPulls.tsx"),
        "repo-home": here("../src/screens/repoHome.tsx"),
        issue: here("../src/screens/issue.tsx"),
        "repo-issues": here("../src/screens/repoIssues.tsx"),
        raise: here("../src/screens/raise.tsx"),
        issues: here("../src/screens/issues.tsx"),
        run: here("../src/screens/run.tsx"),
        actions: here("../src/screens/actions.tsx"),
        releases: here("../src/screens/releases.tsx"),
        notifications: here("../src/screens/notifications.tsx"),
        "person-repos": here("../src/screens/personRepos.tsx"),
        profile: here("../src/screens/profile.tsx")
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: watch ? "[name].js" : "[name]-[hash].js",
        assetFileNames: "[name][extname]",
        /*
         * What WXT's own build does for a content script, done here by hand: the
         * extension APIs are reached through a bare `browser`, which is a global in
         * one browser and not in the other, and these files are built outside the
         * tooling that papers over the difference.
         *
         * Assigned to the global rather than declared as a `const`. A declaration is
         * a binding nothing in its own chunk uses — the references are in the chunks
         * beside it — so the minifier is right to remove it, and did. This is a
         * statement about the world instead, which is also the only shape that
         * reaches every chunk from one place.
         */
        intro: "globalThis.browser ??= globalThis.chrome;"
      }
    }
  },
  logLevel: "warn"
})

// Said again on every rebuild, and not only because it is how you can see that
// watching is working: scripts/dev.ts waits for the first one before it starts
// `wxt`, which would otherwise copy a `public/screens` that is not there yet.
if (watch) {
  ;(result as unknown as Watcher).on("event", (event) => {
    if (event.code === "END") console.log("built public/screens/")
    if (event.code === "ERROR") console.error(event.error?.message ?? "screens build failed")
  })
} else {
  console.log("built public/screens/")
}
