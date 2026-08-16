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
    bun: {
      entrypoint: "src/bun/index.ts",
      /*
       * The OAuth app, put into the bundle rather than left to be read at
       * launch.
       *
       * An app opened from Finder inherits launchd's environment, which is
       * `/usr/bin:/bin:/usr/sbin:/sbin` and nothing else — no `GITHUB_CLIENT_ID`,
       * whatever the shell that built it had. So every release shipped a sign-in
       * button that refused before it reached the network, saying the client id
       * was missing, and pressing it again said the same thing. Bun's `define`
       * replaces each expression below with a literal while bundling, which is
       * how GitHub's own MCP server ships the same pair through linker flags.
       *
       * Neither is a secret. A device-flow client id is published in the app
       * that uses it, and the "secret" GitHub asks for when exchanging a code is
       * one every reader can pull out of the bundle: PKCE is what makes the
       * exchange safe. See `src/bun/oauth.ts`.
       *
       * Empty where nobody set them, which is a build that offers no sign-in and
       * says so on the panel rather than on a press.
       */
      define: {
        "process.env.GITHUB_CLIENT_ID": JSON.stringify(process.env.GITHUB_CLIENT_ID ?? ""),
        "process.env.GITHUB_CLIENT_SECRET": JSON.stringify(process.env.GITHUB_CLIENT_SECRET ?? "")
      }
    },
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
      "src/view/markdown-mermaid.js": "views/main/markdown-mermaid.js",
      /*
       * The captures the onboarding shows, copied out of the site by
       * `scripts/copy-shots.ts`. Which ones there are is decided by `beats.ts`, and
       * that script fails the build if the tour names a screen the site has never
       * photographed.
       */
      "src/view/shots": "views/main/shots"
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
  },
  /*
   * Where a built app looks for the next one.
   *
   * This address is written into the bundle, so it is the one thing here that a
   * shipped app cannot be talked out of. `releases/latest/download/NAME` is the
   * only link to a release asset that outlives the release it was written
   * against, which is what makes it usable from inside a build that was made
   * months ago — the same reason `release.yml` attaches the disk image under a
   * fixed second name. The updater asks for `stable-macos-arm64-update.json`
   * under it, compares the hash with its own, and fetches
   * `stable-macos-arm64-GitQuiet.app.tar.zst` when they differ.
   *
   * Patches are asked for and will not be found, which costs a reader a twenty
   * megabyte download instead of a few hundred kilobytes. Generating one means
   * reading the previous release's `update.json` from this address while
   * building, and by then the tag being built is itself the latest release with
   * nothing attached to it yet. The updater falls back to the whole tarball on
   * its own, so this is a size rather than a fault, and it is left as a size
   * rather than being fixed with a second address that could go stale.
   *
   * A development build never asks: Electrobun's updater refuses on the `dev`
   * channel before it reads this.
   */
  release: {
    baseUrl: "https://github.com/flazouh/gitquiet/releases/latest/download"
  }
} satisfies ElectrobunConfig
