/* eslint-disable no-console */
import { parse } from "@babel/parser"
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { extname, basename, dirname, join } from "node:path"

const APPLY = process.argv.includes("--apply")
const PRUNE_PKG = process.argv.includes("--prune-package-json")
const FORCE = process.argv.includes("--force")

const SELF = "scripts/strip-context.ts"

const DELETE_DIRS = ["docs/", "plans/", "site/", "video/", "store/", "shots/", "fixtures/", "tests/", ".claude/", ".github/ISSUE_TEMPLATE/"]

const DELETE_FILES = new Set([
  "README.md",
  "CONTEXT.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "desktop/README.md",
])

const DELETE_GLOBS = [
  /^scripts\/(probe|verify|benchmark|diagnose|qa|capture)-/,
  /^scripts\/(record-race|shoot-notifications|one-copy|switch-audit|scratch-scenarios|scrub-fixtures|check-drift|decode-one)\./,
]

const KEEP_GLOBS = [/^shots\/mock\//, /^shots\/view\.ts$/]

const KEEP_FILES = new Set(["LICENSE", "NOTICE", SELF])

const FUNCTIONAL = [
  /^\s*eslint-(disable|enable)/,
  /^\s*oxlint-(disable|enable)/,
  /^\s*biome-ignore/,
  /^\s*prettier-ignore/,
  /@ts-(expect-error|ignore|nocheck)/,
  /@vitest-environment/,
  /@vite-ignore/,
  /webpack(Ignore|ChunkName|Mode)/,
  /^\s*#__PURE__\s*$/,
  /(^|\s)(c8|v8|istanbul|node:coverage)\s+ignore/,
  /^\/\s*<reference/,
  /^#\s*sourceMappingURL/,
  /@(license|preserve|copyright)\b/,
  /^\*\s*@vue\/|^\*!/,
]

const isFunctional = (value: string) => FUNCTIONAL.some((rule) => rule.test(value))

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"])

const tracked = () =>
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0")
    .filter(Boolean)

const isTest = (path: string) => {
  const name = basename(path)
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) return true
  if (/(^|\/)__(tests|mocks|fixtures|snapshots)__\//.test(path)) return true
  return false
}

const isDoomed = (path: string) => {
  if (KEEP_FILES.has(path)) return false
  if (DELETE_FILES.has(path)) return true
  if (KEEP_GLOBS.some((glob) => glob.test(path))) return isTest(path) || path.endsWith(".md")
  if (DELETE_DIRS.some((dir) => path.startsWith(dir))) return true
  if (DELETE_GLOBS.some((glob) => glob.test(path))) return true
  if (path.endsWith(".md")) return true
  if (isTest(path)) return true
  return false
}

const pluginsFor = (path: string): string[][] => {
  const ext = extname(path)
  if (ext === ".tsx") return [["typescript", "jsx"]]
  if (ext === ".ts") return [["typescript"], ["typescript", "jsx"]]
  return [["jsx"], ["jsx", "typescript"]]
}

type Parsed = { comments: { start: number; end: number; value: string }[] }

const parseAny = (source: string, path: string): Parsed => {
  let last: unknown
  for (const plugins of pluginsFor(path)) {
    for (const sourceType of ["module", "script"] as const) {
      try {
        return parse(source, {
          sourceType,
          plugins: [...plugins, "decorators-legacy", "importAttributes", "explicitResourceManagement"] as never,
          ranges: true,
          errorRecovery: false,
          allowReturnOutsideFunction: true,
          allowAwaitOutsideFunction: true,
          allowSuperOutsideMethod: true,
        }) as unknown as Parsed
      } catch (error) {
        last = error
      }
    }
  }
  throw last
}

const stripComments = (source: string, path: string): string => {
  const ast = parseAny(source, path)
  const doomed = ast.comments.filter((comment) => !isFunctional(comment.value))
  if (doomed.length === 0) return source

  const removed = new Uint8Array(source.length)
  for (const comment of doomed) removed.fill(1, comment.start, comment.end)

  const out: string[] = []
  let cursor = 0
  while (cursor <= source.length) {
    const breakAt = source.indexOf("\n", cursor)
    const end = breakAt === -1 ? source.length : breakAt
    let kept = ""
    let touched = false
    for (let i = cursor; i < end; i += 1) {
      if (removed[i]) touched = true
      else kept += source[i]
    }
    const blank = kept.trim() === ""
    if (!(touched && blank)) out.push(kept.replace(/\s+$/, ""))
    if (breakAt === -1) break
    cursor = breakAt + 1
  }

  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "")
  return text.endsWith("\n") ? text : `${text}\n`
}

const stripCss = (source: string): string => {
  let out = ""
  let i = 0
  while (i < source.length) {
    const two = source.slice(i, i + 2)
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2)
      const body = source.slice(i + 2, end === -1 ? source.length : end)
      if (/@(license|preserve)\b/.test(body) || source[i + 2] === "!") {
        const stop = end === -1 ? source.length : end + 2
        out += source.slice(i, stop)
        i = stop
        continue
      }
      i = end === -1 ? source.length : end + 2
      continue
    }
    const ch = source[i]
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < source.length && source[j] !== ch) j += source[j] === "\\" ? 2 : 1
      out += source.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += ch
    i += 1
  }
  return out.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n")
}

const TOML_LONG_D = '"'.repeat(3)
const TOML_LONG_S = "'".repeat(3)

const stripHash = (source: string, kind: "yaml" | "toml" | "shell"): string => {
  const out: string[] = []
  let blockIndent: number | null = null
  let longString: string | null = null

  for (const [index, line] of source.split("\n").entries()) {
    const indent = line.length - line.trimStart().length

    if (kind === "toml" && longString !== null) {
      out.push(line)
      if (line.includes(longString)) longString = null
      continue
    }
    if (kind === "yaml" && blockIndent !== null) {
      if (line.trim() === "" || indent > blockIndent) {
        out.push(line)
        continue
      }
      blockIndent = null
    }
    if (kind === "shell" && index === 0 && line.startsWith("#!")) {
      out.push(line)
      continue
    }

    let quote: string | null = null
    let cut = -1
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (kind === "toml" && quote === null && (line.startsWith(TOML_LONG_D, i) || line.startsWith(TOML_LONG_S, i))) {
        const mark = line.startsWith(TOML_LONG_D, i) ? TOML_LONG_D : TOML_LONG_S
        if (line.indexOf(mark, i + 3) === -1) longString = mark
        break
      }
      if (quote !== null) {
        if (ch === "\\" && kind !== "yaml") i += 1
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'") quote = ch
      else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1] ?? ""))) {
        cut = i
        break
      }
    }

    if (cut === -1) out.push(line)
    else if (line.slice(0, cut).trim() === "") continue
    else out.push(line.slice(0, cut).replace(/\s+$/, ""))

    if (kind === "yaml" && /[|>][+-]?\d*\s*$/.test(out[out.length - 1] ?? "")) blockIndent = indent
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").trimEnd()}\n`
}

const stripJsonc = (source: string): string => {
  let out = ""
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === '"') {
      let j = i + 1
      while (j < source.length && source[j] !== '"') j += source[j] === "\\" ? 2 : 1
      out += source.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (source.startsWith("//", i)) {
      const end = source.indexOf("\n", i)
      i = end === -1 ? source.length : end
      continue
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }
    out += ch
    i += 1
  }
  const lines = out.split("\n").filter((line, index, all) => line.trim() !== "" || (index > 0 && all[index - 1]?.trim() !== ""))
  return `${lines.join("\n").replace(/[ \t]+$/gm, "").trimEnd()}\n`
}

const stripHtml = (source: string): string =>
  source.replace(/<!--(?![>\[])[\s\S]*?-->/g, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n")

const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()
if (dirty && !FORCE) {
  console.error("The working tree has uncommitted changes. Commit them first, or pass --force.")
  console.error(dirty.split("\n").slice(0, 10).join("\n"))
  process.exit(1)
}

const files = tracked()
const doomed: string[] = []
const edits: { path: string; before: number; after: number }[] = []
const failures: { path: string; reason: string }[] = []

for (const path of files) {
  if (isDoomed(path)) {
    doomed.push(path)
    continue
  }
  if (KEEP_FILES.has(path) && path !== SELF) continue

  const ext = extname(path)
  let next: string | null = null
  const source = (() => {
    try {
      return readFileSync(path, "utf8")
    } catch {
      return null
    }
  })()
  if (source === null) continue

  try {
    if (CODE_EXT.has(ext)) next = stripComments(source, path)
    else if (ext === ".css") next = stripCss(source)
    else if (ext === ".html") next = stripHtml(source)
    else if (ext === ".yml" || ext === ".yaml") next = stripHash(source, "yaml")
    else if (ext === ".toml") next = stripHash(source, "toml")
    else if (ext === ".sh") next = stripHash(source, "shell")
    else if (ext === ".json") next = stripJsonc(source)
  } catch (error) {
    failures.push({ path, reason: String((error as Error).message ?? error).split("\n")[0] ?? "" })
    continue
  }
  if (next === null || next === source) continue

  if (CODE_EXT.has(ext)) {
    try {
      parseAny(next, path)
    } catch (error) {
      failures.push({ path, reason: `would not re-parse: ${String((error as Error).message ?? error).split("\n")[0] ?? ""}` })
      continue
    }
  }

  edits.push({ path, before: source.split("\n").length, after: next.split("\n").length })
  if (APPLY) writeFileSync(path, next)
}

if (APPLY && doomed.length > 0) {
  for (let i = 0; i < doomed.length; i += 200) {
    execFileSync("git", ["rm", "-q", "--cached", "--", ...doomed.slice(i, i + 200)])
  }
  for (const path of doomed) if (existsSync(path)) rmSync(path, { force: true })
}

const gone = new Set(doomed)
const stillThere = (target: string) =>
  !gone.has(target) && ![...gone].some((path) => target.endsWith("/") && path.startsWith(target))

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
const deadScripts = Object.entries(pkg.scripts ?? {}).filter(([, body]) =>
  /\b(shots|site|video|store|fixtures|tests)\b|--test|\btest\b/.test(String(body)),
)

if (PRUNE_PKG && APPLY) {
  for (const [name] of deadScripts) delete pkg.scripts[name]
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`)
}

const label = APPLY ? "removed" : "would remove"
const byTop = new Map<string, number>()
for (const path of doomed) {
  const top = path.includes("/") ? `${path.split("/")[0]}/` : "(root)"
  byTop.set(top, (byTop.get(top) ?? 0) + 1)
}

console.log(`\n${label} ${doomed.length} files:`)
for (const [top, count] of [...byTop].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(5)}  ${top}`)

const linesBefore = edits.reduce((sum, edit) => sum + edit.before, 0)
const linesAfter = edits.reduce((sum, edit) => sum + edit.after, 0)
console.log(`\n${APPLY ? "stripped" : "would strip"} comments from ${edits.length} files: ${linesBefore} -> ${linesAfter} lines (-${linesBefore - linesAfter})`)

if (failures.length > 0) {
  console.log(`\nleft untouched, ${failures.length} files could not be handled safely:`)
  for (const failure of failures.slice(0, 20)) console.log(`  ${failure.path}: ${failure.reason}`)
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`)
}

const residue: { path: string; count: number }[] = []
for (const edit of edits) {
  const text = readFileSync(edit.path, "utf8")
  const count = text.split("\n").filter((line) => /^\s*(\/\/|\/\*)/.test(line) && !isFunctional(line.trim().replace(/^\/\/|^\/\*/, ""))).length
  if (count > 0) residue.push({ path: edit.path, count })
}
if (residue.length > 0 && APPLY) {
  residue.sort((a, b) => b.count - a.count)
  const total = residue.reduce((sum, item) => sum + item.count, 0)
  console.log(`\nprose left inside template literals, ${total} lines a parser cannot reach:`)
  for (const item of residue.slice(0, 15)) console.log(`  ${String(item.count).padStart(4)}  ${item.path}`)
  if (residue.length > 15) console.log(`  ... and ${residue.length - 15} more files`)
}

if (deadScripts.length > 0) {
  console.log(`\npackage.json scripts pointing at removed paths${PRUNE_PKG && APPLY ? " (pruned)" : " (use --prune-package-json)"}:`)
  for (const [name] of deadScripts) console.log(`  ${name}`)
}

const RESOLVE_EXT = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".html"]
const candidates = (base: string) => [
  ...RESOLVE_EXT.map((ext) => `${base}${ext}`),
  ...RESOLVE_EXT.filter(Boolean).map((ext) => `${base}/index${ext}`),
]

const dangling: { path: string; specifier: string }[] = []
for (const path of files) {
  if (isDoomed(path) || !CODE_EXT.has(extname(path))) continue
  const text = readFileSync(path, "utf8")
  for (const match of text.matchAll(/(?:from|import|require\()\s*["'`](\.[^"'`]+)["'`]/g)) {
    const specifier = match[1]
    if (specifier === undefined) continue
    const base = join(dirname(path), specifier).replaceAll("\\", "/")
    const resolvable = candidates(base).filter((option) => files.includes(option))
    if (resolvable.length > 0 && resolvable.every((option) => gone.has(option))) {
      dangling.push({ path, specifier })
    }
  }
}
if (dangling.length > 0) {
  console.log(`\nimports pointing at removed files, ${dangling.length} to fix by hand:`)
  for (const item of dangling.slice(0, 20)) console.log(`  ${item.path} -> ${item.specifier}`)
  if (dangling.length > 20) console.log(`  ... and ${dangling.length - 20} more`)
}

const orphanConfig = ["bunfig.toml", "lefthook.yml", "wxt.config.ts", ".oxlintrc.json", "tsconfig.json"].filter(
  (path) => stillThere(path) && /\b(tests?|shots|site|video|fixtures)\b/.test(readFileSync(path, "utf8")),
)
if (orphanConfig.length > 0) {
  console.log(`\nconfig still naming removed paths, check by hand:`)
  for (const path of orphanConfig) console.log(`  ${path}`)
}

console.log(
  APPLY
    ? "\nDone. Review with `git status` and `git diff`; `git checkout -- .` undoes it.\n"
    : "\nDry run. Nothing was written. Re-run with --apply.\n",
)
