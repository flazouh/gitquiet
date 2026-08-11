import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The stage the store images are photographed on.
 *
 *     bun run shots:dev        the stage, to look at
 *     bun run shots            every view, captured to site/public/shots
 *
 * Built against the repository's own dependencies rather than its own, because it
 * mounts the repository's own screens: `src/ui/WorkingSetScreen.tsx` and the eleven
 * beside it, with the same providers, the same stylesheet and the same theme packs.
 * A second copy of React or of Effect here would be two Reacts in one tree.
 *
 * The same three aliases `scripts/build-screens.ts` sets, for the same reasons. The
 * Shiki substitution matters here too: the diff on the pull request view is rendered
 * by the real engine, and the full grammar bundle is seven hundred languages nobody
 * writes a pull request in.
 */
export default defineConfig({
  root: here("."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: here("../src/$1") },
      { find: /^shiki$/, replacement: here("../src/diff/shiki.ts") },
      { find: /^shiki\/wasm$/, replacement: here("../src/diff/shiki-wasm.ts") }
    ]
  },
  /*
   * The repository's own `public/`, so the diff engine is at `/diff-engine.js` here
   * exactly as it is inside the extension. It is built, not committed, so the pull
   * request view needs `bun run build:diff-engine` before it can draw a diff.
   */
  publicDir: here("../public"),
  server: { port: 5199, strictPort: true },
  build: { outDir: here("../.output/shots"), emptyOutDir: true }
})
