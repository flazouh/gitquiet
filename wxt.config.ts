import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  /** Everything the extension is built from lives in `src`, entrypoints included. */
  srcDir: "src",
  manifest: {
    name: "githubpro",
    description:
      "Replaces a pull request's conversation with a view organised by whose move it is.",
    host_permissions: ["*://github.com/*"],
    // Court corrections are kept in extension storage. Without this the API is
    // simply absent in the content script, and since a store we cannot read is
    // treated as empty, every correction is lost with nothing said about it.
    permissions: ["storage"]
  },
  vite: () => ({
    plugins: [tailwindcss()]
  })
})
