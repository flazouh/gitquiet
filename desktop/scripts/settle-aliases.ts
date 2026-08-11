/**
 * Rewrites `~/…` imports to relative ones, in place.
 *
 * Electrobun's command line is a compiled Bun executable, and a compiled Bun
 * executable does not read a `tsconfig.json` — so the bundler inside it resolves
 * no `paths` at all, and neither a `tsconfig` build option nor a package.json
 * `imports` field reaches it. `bun build` on its own resolves the alias; the one
 * inside `bin/electrobun` cannot.
 *
 * That only matters for files `shadcn add` writes, because it emits the alias
 * form and everything we write by hand could simply be relative. So this is the
 * step that meets it: run after adding from a registry, and the vendored files
 * import each other the way the bundler can follow. It is idempotent — once a
 * file holds no `~/`, running again does nothing — so the build runs it every
 * time rather than asking anybody to remember.
 *
 * The alias stays in `tsconfig.json` regardless: `shadcn` reads it to decide
 * where a component belongs, and that happens before this script sees the file.
 */
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"

const here = new URL("..", import.meta.url).pathname
const root = join(here, "src")

const sources = async function* (dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sources(path)
    else if (/\.tsx?$/.test(entry.name)) yield path
  }
}

/** `~/lib/utils` seen from `src/components/ui/button.tsx` is `../../lib/utils`. */
const settle = (from: string, specifier: string) => {
  const target = join(root, specifier.slice("~/".length))
  const path = relative(join(from, ".."), target)
  return path.startsWith(".") ? path : `./${path}`
}

let changed = 0

for await (const file of sources(root)) {
  const before = await Bun.file(file).text()
  const after = before.replace(
    /(from\s+")(~\/[^"]+)(")/g,
    (_all, open: string, specifier: string, close: string) => `${open}${settle(file, specifier)}${close}`
  )
  if (after === before) continue
  await Bun.write(file, after)
  changed += 1
  console.log(`settled ${relative(root, file)}`)
}

if (changed > 0) console.log(`${changed} file${changed === 1 ? "" : "s"} no longer need the alias.`)
