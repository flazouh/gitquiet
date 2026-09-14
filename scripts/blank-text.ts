/* eslint-disable no-console */
import { parse } from "@babel/parser"
import { readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { extname } from "node:path"

type Node = { type: string; [key: string]: unknown }

/**
 * A plain walk over the parse tree.
 *
 * `@babel/traverse` would do this, but it is not a dependency here and the three
 * node types below need no scope or parent tracking to recognise.
 */
const walkTree = (node: unknown, visit: (node: Node) => void) => {
  if (node === null || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const child of node) walkTree(child, visit)
    return
  }
  const current = node as Node
  if (typeof current.type === "string") visit(current)
  for (const key of Object.keys(current)) {
    if (key === "loc" || key === "range" || key === "leadingComments" || key === "trailingComments") continue
    walkTree(current[key], visit)
  }
}

// ---------------------------------------------------------------------------
// blank-text — replace reader-facing copy with numbered placeholders.
//
// The old wording goes, the code keeps compiling, and the placeholders become
// the keys an i18n layer fills in later.
//
//   bun scripts/blank-text.ts            # dry run
//   bun scripts/blank-text.ts --apply
//
// Only three positions are touched, because only three can be identified without
// guessing. Most string literals in this repository are Tailwind class lists or
// GitHub DOM selectors that happen to read like English, and blanking one of
// those breaks the page silently rather than loudly.
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes("--apply")
const FORCE = process.argv.includes("--force")
const MANIFEST = "../gitquiet-text-manifest.json"

/** JSX attributes a reader hears or sees. Anything not named here is left alone. */
const SPOKEN_ATTRS = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "summary",
  "title",
])

/**
 * Copy tables, named one by one rather than detected.
 *
 * A table of words keyed by a state looks exactly like a table of API enum values
 * keyed by the same state — `REASON_OF` in `GitHubGateway.ts` holds `COMPLETED`
 * and `NOT_PLANNED`, which GitHub sends and reads back. Blanking that would break
 * closing an issue. So the list is written out, and anything new has to be added.
 */
const COPY_TABLES: Record<string, string[]> = {
  "src/ui/Ask.tsx": ["WORDS", "MERGE_WORD", "STACK_MERGE_WORD", "UPDATE_WORD"],
  "src/ui/Filters.tsx": ["EXAMPLE"],
  "src/ui/Header.tsx": ["BADGE_WORD", "STATE_VERB"],
  "src/ui/Icon.tsx": ["OPINION_WORDS", "STATE_WORDS"],
  "src/ui/IssueHeader.tsx": ["CLOSING_WORD"],
  "src/ui/IssuesScreen.tsx": ["WHAT"],
  "src/ui/Merge.tsx": ["SECTION_FOR"],
  "src/ui/Notices.tsx": ["SAID"],
  "src/ui/RunScreen.tsx": ["WORD_OF"],
  "src/ui/StackTree.tsx": ["BADGE"],
  "src/ui/Strands.tsx": ["WORD_OF"],
  "src/ui/TheStack.tsx": ["BADGE"],
  "src/ui/Verdict.tsx": ["SAID"],
  "src/ui/courts.ts": ["COURT_NAME", "COURT_MEANS"],
  "src/ui/rowDoings.ts": ["WORD"],
}

type Edit = { start: number; end: number; original: string; kind: string; line: number; quoted: boolean }

const pluginsFor = (path: string) => (extname(path) === ".tsx" ? ["typescript", "jsx"] : ["typescript"])

const parseAny = (source: string, path: string) =>
  parse(source, { sourceType: "module", plugins: pluginsFor(path) as never, ranges: true })

/** Every string value under an object, however deeply nested. Keys are never touched. */
const valuesUnder = (node: never, into: Edit[], line: (n: number) => number) => {
  const walk = (current: { type: string; properties?: unknown[]; elements?: unknown[]; value?: unknown; start?: number; end?: number }) => {
    if (current.type === "StringLiteral") {
      if (String(current.value).trim() === "") return
      into.push({ start: current.start!, end: current.end!, original: String(current.value), kind: "table", line: line(current.start!), quoted: true })
      return
    }
    if (current.type === "ObjectExpression") {
      for (const property of current.properties as { type: string; value?: unknown }[]) {
        if (property.type === "ObjectProperty") walk(property.value as never)
      }
    }
    if (current.type === "ArrayExpression") for (const element of current.elements as never[]) if (element) walk(element)
  }
  walk(node)
}

const collect = (source: string, path: string): Edit[] => {
  const ast = parseAny(source, path)
  const edits: Edit[] = []
  const lineAt = (offset: number) => source.slice(0, offset).split("\n").length
  const tables = COPY_TABLES[path] ?? []

  walkTree(ast.program as never, (node) => {
    if (node.type === "JSXText") {
      const raw = String(node.value)
      if (raw.trim() === "") return
      const lead = raw.length - raw.trimStart().length
      const trail = raw.length - raw.trimEnd().length
      const start = (node.start as number) + lead
      edits.push({ start, end: (node.end as number) - trail, original: raw.trim(), kind: "jsx-text", line: lineAt(start), quoted: false })
      return
    }

    if (node.type === "JSXAttribute") {
      const name = (node.name as { name?: string }).name
      const value = node.value as { type: string; value: string; start: number; end: number } | null
      if (typeof name !== "string" || !SPOKEN_ATTRS.has(name)) return
      if (!value || value.type !== "StringLiteral") return
      // An empty `alt` marks a decorative image; filling it makes a screen reader
      // announce a placeholder where the author meant silence.
      if (value.value.trim() === "") return
      edits.push({ start: value.start, end: value.end, original: value.value, kind: `attr:${name}`, line: lineAt(value.start), quoted: true })
      return
    }

    if (node.type === "VariableDeclarator") {
      const id = node.id as { type: string; name?: string }
      const init = node.init as { type: string } | null
      if (id.type !== "Identifier" || !id.name || !tables.includes(id.name)) return
      if (!init || init.type !== "ObjectExpression") return
      valuesUnder(init as never, edits, lineAt)
    }
  })

  return edits.sort((a, b) => a.start - b.start)
}

// --- run -------------------------------------------------------------------

const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()
if (dirty && !FORCE) {
  console.error("The working tree has uncommitted changes. Commit them first, or pass --force.")
  process.exit(1)
}

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 })
  .split("\0")
  .filter(Boolean)
  .filter((path) => [".ts", ".tsx"].includes(extname(path)))
  .filter((path) => !/\.(test|spec)\./.test(path))
  .sort()

const plan: { path: string; source: string; edits: Edit[] }[] = []
const failures: { path: string; reason: string }[] = []

for (const path of files) {
  const source = readFileSync(path, "utf8")
  try {
    const edits = collect(source, path)
    if (edits.length > 0) plan.push({ path, source, edits })
  } catch (error) {
    failures.push({ path, reason: String((error as Error).message ?? error).split("\n")[0] ?? "" })
  }
}

const total = plan.reduce((sum, file) => sum + file.edits.length, 0)
const width = String(total).length
let counter = 0
const manifest: { id: string; file: string; line: number; kind: string; text: string }[] = []
const byKind = new Map<string, number>()

for (const file of plan) {
  let next = file.source
  const numbered = file.edits.map((edit) => {
    counter += 1
    const id = `TEXT_${String(counter).padStart(width, "0")}`
    manifest.push({ id, file: file.path, line: edit.line, kind: edit.kind, text: edit.original })
    const group = edit.kind.startsWith("attr:") ? "attribute" : edit.kind
    byKind.set(group, (byKind.get(group) ?? 0) + 1)
    return { edit, id }
  })

  // Right to left, so earlier offsets stay valid.
  for (const { edit, id } of [...numbered].reverse()) {
    next = next.slice(0, edit.start) + (edit.quoted ? `"${id}"` : id) + next.slice(edit.end)
  }

  try {
    parseAny(next, file.path)
  } catch (error) {
    failures.push({ path: file.path, reason: `would not re-parse: ${String((error as Error).message ?? error).split("\n")[0] ?? ""}` })
    continue
  }
  if (APPLY) writeFileSync(file.path, next)
}

if (APPLY) writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`\n${APPLY ? "replaced" : "would replace"} ${total} strings across ${plan.length} files`)
for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(5)}  ${kind}`)

console.log(`\nbusiest files:`)
for (const file of [...plan].sort((a, b) => b.edits.length - a.edits.length).slice(0, 10)) {
  console.log(`  ${String(file.edits.length).padStart(5)}  ${file.path}`)
}

if (failures.length > 0) {
  console.log(`\nleft untouched, ${failures.length} files:`)
  for (const failure of failures.slice(0, 15)) console.log(`  ${failure.path}: ${failure.reason}`)
}

console.log(
  APPLY
    ? `\nDone. Originals written to ${MANIFEST}, outside the repository. \`git checkout -- .\` undoes the code changes.\n`
    : `\nDry run. Nothing was written. Re-run with --apply.\n`,
)
