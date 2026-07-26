import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  /**
   * Everything the extension is built from lives in `src`, entrypoints included.
   * WXT derives `@` from this and cannot be told otherwise — it sets the alias
   * after merging ours — and registry components import from `@/lib/…`, so the
   * source directory is what has to agree with them.
   */
  srcDir: "src",
  manifest: {
    name: "githubpro",
    description:
      "Replaces GitHub's pull request pages with an interface organised by attention.",
    host_permissions: ["*://github.com/*"],
    // Court corrections are kept in extension storage. Without this the API is
    // simply absent in the content script, and since a store we cannot read is
    // treated as empty, every correction is lost with nothing said about it.
    permissions: ["storage"],
    // The bundled font is fetched by the document once our stylesheet asks for
    // it, so it has to be reachable from the page as well as from the extension.
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: ["*://github.com/*"]
      }
    ]
  },
  vite: () => ({
    plugins: [tailwindcss()]
  })
})
