import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const here = path.dirname(fileURLToPath(import.meta.url))
const viewRoot = path.join(here, "src/view")
const sharedSrc = path.join(here, "../src")
/** The fixtures the onboarding's screens are drawn from, shared with the site. */
const fixtures = path.join(here, "../shots")

/**
 * Dev-only Vite server for view HMR.
 *
 * Production still uses Electrobun's view bundler (`electrobun.config.ts`).
 * This config only serves `src/view` during `bun run dev`, rewriting the
 * HTML entry so the webview loads TypeScript through Vite instead of the
 * prebuilt `index.js`.
 */
export default defineConfig({
  root: viewRoot,
  plugins: [
    react(),
    // Compile Tailwind from the source stylesheet. Production still runs
    // `bun run css` and Electrobun bundles the emitted `index.css`.
    tailwindcss(),
    {
      name: "working-set-hmr-entry",
      transformIndexHtml(html) {
        // Drop the static CSS link: the entry imports `index.css`, which the
        // alias below rewrites to `style.css` so Tailwind's Vite plugin owns it.
        return html
          .replace(/\s*<link rel="stylesheet" href="index\.css" \/>/, "")
          .replace('src="index.js"', 'src="/index.tsx"')
      }
    }
  ],
  resolve: {
    alias: [
      { find: "@", replacement: sharedSrc },
      { find: "~", replacement: path.join(here, "src") },
      // Electrobun bundles compiled `index.css`; Vite should own the source.
      { find: path.join(viewRoot, "index.css"), replacement: path.join(viewRoot, "style.css") },
      { find: /^\.\/index\.css$/, replacement: path.join(viewRoot, "style.css") }
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      // View imports shared UI under ../src and the onboarding's fixtures under
      // ../shots; Inter lives in the workspace node_modules, which Vite blocks
      // unless listed.
      allow: [here, sharedSrc, fixtures, path.join(here, "../node_modules")]
    }
  },
  optimizeDeps: {
    include: ["electrobun/view"]
  }
})
