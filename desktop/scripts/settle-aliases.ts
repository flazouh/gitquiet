/**
 * Rewrites aliased imports to relative ones, in place, in the trees this window bundles.
 *
 * Electrobun's command line is a compiled Bun executable, and a compiled Bun
 * executable does not read a `tsconfig.json` — so the bundler inside it resolves
 * no `paths` at all, and neither a `tsconfig` build option nor a package.json
 * `imports` field reaches it. `bun build` on its own resolves the alias; the one
 * inside `bin/electrobun` cannot.
 *
 * Two aliases, for two reasons neither of which is anybody writing by hand:
 *
 * `~/…` is what `shadcn add` emits into `desktop/src`, and everything we write there
 * could simply be relative.
 *
 * `@/…` is what `shots/` is written in, because it was written for the site's bundler
 * and the capture stage's, both of which resolve it. The window reads that tree too now:
 * the onboarding draws the real screens under the same fixture data rather than showing
 * photographs of them, so five fixture files became files this bundler has to follow.
 *
 * Both are idempotent — once a file holds neither prefix, running again does nothing —
 * so the build runs this every time rather than asking anybody to remember. Relative is
 * the form every bundler here agrees on, so settling one costs the site nothing.
 *
 * The aliases stay in the `tsconfig.json` files regardless: `shadcn` reads `~` to decide
 * where a component belongs, and that happens before this script sees the file.
 */
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL("..", import.meta.url))
const repo = join(here, "..")

/**
 * A tree to walk, the prefix to settle in it, and what that prefix means.
 *
 * `root` is what the alias stands for rather than where the files are: `@/ui/Theme` is
 * `src/ui/Theme` seen from wherever the importer sits, which for `shots/mock` is two
 * directories up and one back down.
 */
const TREES = [
  { tree: join(here, "src"), prefix: "~/", root: join(here, "src") },
  { tree: join(repo, "shots"), prefix: "@/", root: join(repo, "src") }
] as const

const sources = async function* (dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(path)
    else if (/\.tsx?$/.test(entry.name)) yield path
  }
}

/** `~/lib/utils` seen from `src/components/ui/button.tsx` is `../../lib/utils`. */
const settle = (from: string, root: string, prefix: string, specifier: string) => {
  const target = join(root, specifier.slice(prefix.length))
  const path = relative(join(from, ".."), target)
  return path.startsWith(".") ? path : `./${path}`
}

let changed = 0

for (const { tree, prefix, root } of TREES) {
  /*
   * An import statement, anchored to the start of its line.
   *
   * `import`, `export` or the `}` that closes a multi-line one, with nothing before it.
   * The anchor is what keeps this out of the fixtures' own contents: `shots/mock/patch.ts`
   * holds unified diffs of real source files, every line of which begins with a `+`, a `-`
   * or a space — so a diff of a file of ours that imports through the alias reads as text
   * here rather than as something to rewrite.
   */
  const asked = new RegExp(`^((?:import|export|\\})[^"\\n]*from\\s+")(${prefix}[^"]+)(")`, "gm")

  for await (const file of sources(tree)) {
    const before = await Bun.file(file).text()
    const after = before.replace(asked, (_all, open: string, specifier: string, close: string) => {
      return `${open}${settle(file, root, prefix, specifier)}${close}`
    })
    if (after === before) continue
    await Bun.write(file, after)
    changed += 1
    console.log(`settled ${relative(repo, file)}`)
  }
}

if (changed > 0) console.log(`${changed} file${changed === 1 ? "" : "s"} no longer need an alias.`)
