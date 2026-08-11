import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const diffEngineBeside = (): Plugin => {
  const from = here("../public/diff-engine.js")
  const at = "/diff-engine.js"

  return {
    name: "gitquiet:diff-engine-beside",
    configureServer: (server) => {
      server.middlewares.use(at, (_request, response) => {
        try {
          const held = readFileSync(from)
          response.setHeader("Content-Type", "text/javascript")
          response.end(held)
        } catch {
          response.statusCode = 404
          response.end("diff-engine.js is built, not committed: bun run build:diff-engine")
        }
      })
    },
    generateBundle: function () {
      try {
        this.emitFile({ type: "asset", fileName: "diff-engine.js", source: readFileSync(from) })
      } catch {
        this.warn("no public/diff-engine.js: run bun run build:diff-engine before building")
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), diffEngineBeside()],

  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },

    dedupe: ["react", "react-dom", "effect", "@radix-ui/react-context"]
  },

  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        assets: fileURLToPath(new URL("./assets.html", import.meta.url))
      }
    }
  }
})
