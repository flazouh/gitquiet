/**
 * Puts Inter's own font files beside the compiled stylesheet.
 *
 * Tailwind inlines fontsource's `@font-face` rules without rewriting their
 * `url(./files/…)`, so the only place the webview will look for them is next to
 * `index.css`. Copying rather than committing means `bun update` updates the
 * font.
 *
 * Resolved rather than reached for by path, because this is a workspace: the
 * package hoists to the repository root's `node_modules` and a hard-coded
 * `./node_modules/@fontsource-variable/inter` is a path that exists only until
 * somebody runs an install from the root.
 */
import { cp, rm } from "node:fs/promises"
import { dirname, join } from "node:path"

const here = new URL("..", import.meta.url).pathname
const inter = dirname(Bun.resolveSync("@fontsource-variable/inter/index.css", here))
const beside = join(here, "src/view/files")

await rm(beside, { recursive: true, force: true })
await cp(join(inter, "files"), beside, { recursive: true })
