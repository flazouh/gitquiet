import type { ElectrobunConfig } from "electrobun"

/**
 * The desktop app, as Electrobun needs it described.
 *
 * Two builds from one repository. `bun` is the main process — a real Bun
 * runtime, with no browser around it and so no CORS, no cookie jar it did not
 * ask for, and no page that GitHub can change underneath it. `views.main` is
 * the interface, bundled for a webview, and every file it imports from `../src`
 * is a file the extension is already running.
 */
export default {
  app: {
    name: "GitQuiet",
    identifier: "dev.gitquiet.app",
    /*
     * The tag, when a release is what is building. `.github/workflows/release.yml`
     * reads it off the tag and both this app and the extension's manifest take it
     * from there, so one tag names one version of both and nothing in the tree
     * records it. The fallback is for a build on somebody's own machine, which has
     * no tag and needs a version anyway.
     */
    version: process.env.RELEASE_VERSION ?? "0.0.0",
    description: "Your pull requests, without the browser"
  },
  build: {
    /*
     * No `tsconfig` option here, and not for want of trying one: `bin/electrobun`
     * is a compiled Bun executable, which reads no `tsconfig.json`, and the
     * bundler inside it resolves no `paths` however they are handed over — as a
     * build option, absolute or relative, or as a package.json `imports` field.
     * `bun run aliases` is what answers it instead, by settling the alias in the
     * files a registry wrote before this ever sees them.
     */
    bun: { entrypoint: "src/bun/index.ts" },
    views: { main: { entrypoint: "src/view/index.tsx" } },
    copy: {
      "src/view/index.html": "views/main/index.html",
      /*
       * The same page with an in-memory `localStorage` in front of it, built by
       * `scripts/build-demo-view.ts` and loaded only when `GITQUIET_DEMO`
       * asks for it. Copied unconditionally because the copy map is read at
       * build time and a demo is decided at launch.
       */
      "src/view/demo.html": "views/main/demo.html",
      /*
       * The diff renderer, built by `scripts/build-diff-engine.ts` and fetched at
       * runtime rather than imported. The bundler below inlines every import it can
       * resolve, and this is four hundred syntax grammars that a window should not
       * be parsing before it draws a list.
       */
      "src/view/diff-engine.js": "views/main/diff-engine.js",
      /*
       * The markdown highlighter, built by `scripts/build-markdown-highlighter.ts`
       * and fetched on the first labelled fence. Same reason as the diff engine.
       */
      "src/view/markdown-highlighter.js": "views/main/markdown-highlighter.js",
      /*
       * The mermaid renderer, built by `scripts/build-markdown-mermaid.ts` and
       * fetched on the first mermaid fence. Same reason as the highlighter.
       */
      "src/view/markdown-mermaid.js": "views/main/markdown-mermaid.js"
    },
    /*
     * Signed and notarised only where there is an identity to sign with, which is
     * the release runner and not a laptop. Gatekeeper refuses an unsigned app it
     * downloaded, so a release has to carry both; a build made to look at
     * carries neither, and asking a developer for a certificate to run `bun run
     * build` would be asking for the wrong thing.
     *
     * Notarising also needs an Apple ID, its app password and a team, or an App
     * Store Connect key. `codesign: true` with none of them fails the build
     * rather than shipping something a reader cannot open, which is the right way
     * round.
     *
     * `icons` is left at its default, `icon.iconset`, which `bun
     * scripts/build-icons.ts` writes from the same mark the extension uses.
     */
    mac: {
      codesign: process.env.ELECTROBUN_DEVELOPER_ID !== undefined,
      notarize: process.env.ELECTROBUN_DEVELOPER_ID !== undefined,
      createDmg: true
    }
  }
} satisfies ElectrobunConfig
