/**
 * Every file the desktop window bundles, read for an alias its bundler cannot follow.
 *
 * `bin/electrobun` is a compiled Bun executable and a compiled Bun executable
 * reads no `tsconfig.json`, so the bundler inside it resolves no `paths` —
 * which `desktop/scripts/settle-aliases.ts` answers for the two trees a
 * registry writes, `desktop/src` and `shots`. It cannot answer for `src`: `@/`
 * is how four hundred and sixty imports in there are written and settling them
 * in place would rewrite the extension's own source on every desktop build.
 *
 * So the rule for `src` is the other way round: a file the window reaches is
 * written in relative imports. Nothing enforced it, and nothing noticed when it
 * broke — `bun run compile:desktop` passes, because `tsc` reads the `paths` the
 * bundler cannot, and the tests never bundle the window at all. The first thing
 * to say so was the macOS job of the v0.15.0 release, which built four targets,
 * published three, and failed the fourth with
 *
 *     error: Could not resolve: "@/observability/report"
 *
 * an hour after the tag was written and could not be withdrawn. Seven files had
 * arrived in the window's reach carrying that import, all of them by way of one
 * new screen.
 *
 * Walked rather than grepped: `src` is allowed its alias everywhere the window
 * does not go, and a check that forbade it outright would be a check nobody
 * could keep.
 */
import { readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = fileURLToPath(new URL("..", import.meta.url))

/** What the window is built from, which is what `electrobun.config.ts` names. */
const ENTRIES = ["desktop/src/view/index.tsx", "desktop/src/bun/index.ts"]

/** The two prefixes, and the tree each one stands for. */
const ALIASES = [
  { prefix: "@/", root: join(here, "src") },
  { prefix: "~/", root: join(here, "desktop/src") }
] as const

const SETTLED = new Set(["~/"])

const reached = new Set<string>()
const carrying = new Map<string, Set<string>>()

/** A specifier as a file, trying the endings a bundler tries. */
const fileFor = async (path: string): Promise<string | null> => {
  const tries = [path, `${path}.ts`, `${path}.tsx`, join(path, "index.ts"), join(path, "index.tsx")]
  for (const one of tries) {
    if (/\.tsx?$/.test(one) && (await Bun.file(one).exists())) return one
  }
  return null
}

const walk = async (file: string): Promise<void> => {
  if (reached.has(file)) return
  reached.add(file)

  const text = await readFile(file, "utf8").catch(() => "")
  for (const [, said] of text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) {
    if (said === undefined) continue
    const alias = ALIASES.find((one) => said.startsWith(one.prefix))
    if (alias !== undefined) {
      // `~/` is settled into relative form by the build before the bundler
      // sees it; `@/` in `src` is not, and is what this check is for.
      if (!SETTLED.has(alias.prefix)) {
        const already = carrying.get(relative(here, file)) ?? new Set<string>()
        carrying.set(relative(here, file), already.add(said))
      }
      const target = await fileFor(join(alias.root, said.slice(alias.prefix.length)))
      if (target !== null) await walk(target)
      continue
    }
    if (!said.startsWith(".")) continue
    const target = await fileFor(resolve(dirname(file), said))
    if (target !== null) await walk(target)
  }
}

for (const entry of ENTRIES) await walk(join(here, entry))

if (carrying.size === 0) {
  console.log(`the window reaches ${reached.size} files, none of them aliased`)
  process.exit(0)
}

console.error(
  `The desktop window bundles ${carrying.size} file${carrying.size === 1 ? "" : "s"} its bundler cannot resolve.\n` +
    `Write these imports relative — the alias is fine anywhere the window does not reach:\n`
)
for (const [file, said] of [...carrying].sort()) {
  console.error(`  ${file}: ${[...said].sort().join(", ")}`)
}
process.exit(1)
