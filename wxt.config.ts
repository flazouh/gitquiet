import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "githubpro",
    description:
      "Replaces GitHub's pull request pages with an interface organised by attention.",
    host_permissions: ["*://github.com/*"]
  },
  vite: () => ({
    plugins: [tailwindcss()]
  })
})
