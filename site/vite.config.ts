import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const chunkBeside = (file: string, missing: string): Plugin => {
  const from = here(`../public/${file}`)
  const at = `/${file}`

  return {
    name: `gitquiet:${file}-beside`,
    configureServer: (server) => {
      server.middlewares.use(at, (_request, response) => {
        try {
          const held = readFileSync(from)
          response.setHeader("Content-Type", "text/javascript")
          response.end(held)
        } catch {
          response.statusCode = 404
          response.end(`${file} is built, not committed: ${missing}`)
        }
      })
    },
    generateBundle: function () {
      try {
        this.emitFile({ type: "asset", fileName: file, source: readFileSync(from) })
      } catch {
        this.warn(`no public/${file}: run ${missing} before building`)
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    chunkBeside("diff-engine.js", "bun run build:diff-engine"),
    chunkBeside("markdown-highlighter.js", "bun run build:markdown-highlighter"),
    chunkBeside("markdown-mermaid.js", "bun run build:markdown-mermaid")
  ],

  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },

    dedupe: ["react", "react-dom", "effect", "@radix-ui/react-context"]
  },

  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        assets: fileURLToPath(new URL("./assets.html", import.meta.url)),
        /*
         * `/welcome`, which the extension opens the first time it is installed.
         *
         * A page of its own rather than a route: there is no router here, and one
         * would be a dependency and a history to maintain for a second address.
         * `site/serve.ts` resolves `/welcome` to this file. It does not rewrite
         * unknown addresses to `index.html`; that used to answer `/welcome` with
         * the landing page.
         */
        welcome: fileURLToPath(new URL("./welcome.html", import.meta.url)),

        /*
         * `/install`, which is every way in with the state each one is in. Reached
         * from the hero, from the footer, and from the store listings, so it is a
         * page of its own for the same reason `/welcome` is.
         */
        install: fileURLToPath(new URL("./install.html", import.meta.url)),

        /*
         * `/github-pr-inbox`, a job page for github pr inbox, not a fifth compare.
         *
         * Same reason it is a file rather than a router: `site/serve.ts` maps
         * `/github-pr-inbox` to this HTML, and a crawler has to see a unique title
         * and the H1 in the body without running the bundle first. The copy inside
         * `#page` is that body; React replaces it on mount.
         */
        "github-pr-inbox": fileURLToPath(new URL("./github-pr-inbox.html", import.meta.url)),

        /*
         * `/github-review-queue`, a job page for github review queue, not a fifth
         * compare, distinct from github-pr-inbox.
         *
         * Same reason it is a file rather than a router: `site/serve.ts` maps
         * `/github-review-queue` to this HTML, and a crawler has to see a unique title
         * and the H1 in the body without running the bundle first. The copy inside
         * `#page` is that body; React replaces it on mount.
         */
        "github-review-queue": fileURLToPath(new URL("./github-review-queue.html", import.meta.url)),

        /*
         * Four comparison pages, one axis each. Same reason they are files rather
         * than a router: `site/serve.ts` maps `/compare/prflow` to this HTML, and
         * a crawler has to see a unique title without running the bundle first.
         * A unique title is not enough: they also need the H1 and the job in the
         * body, or they keep only /privacy, which is the one file that was already
         * HTML. The copy inside `#page` is that body; React replaces it on mount.
         */
        "compare/prflow": fileURLToPath(new URL("./compare/prflow.html", import.meta.url)),
        "compare/github-pr-sidebar": fileURLToPath(
          new URL("./compare/github-pr-sidebar.html", import.meta.url)
        ),
        "compare/refined-github": fileURLToPath(
          new URL("./compare/refined-github.html", import.meta.url)
        ),
        "compare/octobox": fileURLToPath(new URL("./compare/octobox.html", import.meta.url))
      }
    }
  }
})
