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
    version: "0.1.0",
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
    }
  }
} satisfies ElectrobunConfig
