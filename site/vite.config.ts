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
        assets: fileURLToPath(new URL("./assets.html", import.meta.url))
      }
    }
  }
})
