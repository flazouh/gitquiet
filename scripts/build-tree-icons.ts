/**
 * Builds the file tree's icon sheet from the Material icon theme.
 *
 *     bun scripts/build-tree-icons.ts
 *
 * The theme ships twelve hundred icons and a mapping from every extension and
 * filename anyone has ever committed to one of them. Shipping all of it into a
 * content script would cost more than the diff renderer does, so this takes the
 * ones a code repository actually contains and writes them out as a single
 * sprite of `<symbol>`s, which is the shape `@pierre/trees` accepts.
 *
 * The output is committed: tests and `bun dev` should not depend on having run
 * a generator, and the sheet only changes when the list below does.
 */

import { readFileSync, writeFileSync } from "node:fs"

type Theme = {
  readonly fileExtensions: Record<string, string>
  readonly fileNames: Record<string, string>
}

/** Extensions worth an icon, which is roughly what a repository is made of. */
const EXTENSIONS = [
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "jsonc", "md", "mdx",
  "css", "scss", "sass", "less", "html", "svg", "png", "jpg", "jpeg", "gif",
  "webp", "ico", "yml", "yaml", "toml", "ini", "env", "sh", "bash", "zsh",
  "py", "rb", "go", "rs", "java", "kt", "swift", "c", "h", "cpp",
  "cs", "php", "sql", "graphql", "vue", "svelte", "astro", "lock", "txt", "xml",
  "csv", "pdf", "zip", "wasm", "prisma", "proto", "tf"
]

/** Files whose name says more than their extension does. */
const NAMES = [
  "package.json", "tsconfig.json", "bun.lock", "bunfig.toml", ".gitignore",
  ".gitattributes", "LICENSE", "README.md", "CHANGELOG.md", "Dockerfile",
  "Makefile", ".env", "eslint.config.js", "vite.config.ts", "biome.json",
  ".prettierrc", ".npmrc", "CONTRIBUTING.md"
]

const root = new URL("../node_modules/material-icon-theme/", import.meta.url)
const theme = JSON.parse(
  readFileSync(new URL("dist/material-icons.json", root), "utf8")
) as Theme

const iconOf = (key: string, table: Record<string, string>): string | undefined => table[key]

const wanted = new Set<string>()
const extensionIcon: Record<string, string> = {}
const nameIcon: Record<string, string> = {}

for (const extension of EXTENSIONS) {
  const icon = iconOf(extension, theme.fileExtensions)
  if (icon === undefined) continue
  wanted.add(icon)
  extensionIcon[extension] = icon
}

for (const name of NAMES) {
  const icon = iconOf(name.toLowerCase(), theme.fileNames) ?? iconOf(name, theme.fileNames)
  if (icon === undefined) continue
  wanted.add(icon)
  nameIcon[name] = icon
}

// The plain document, for everything the lists above do not name.
wanted.add("document")

/**
 * The tree draws an icon at sixteen square unless told otherwise, and these are
 * drawn at sixteen, twenty-four or thirty-two, so each one carries its own box
 * to be scaled into.
 */
/**
 * What the `<svg>` tag says about painting, which its children are counting on.
 *
 * Dropping the tag drops what it declared. Four of these icons — `readme`,
 * `document`, `changelog`, `settings` — open with a full-box rectangle that is
 * there to hold the icon's proportions and is drawn only because the root said
 * `fill="none"`; without that, each one became a solid block in the colour of
 * the row behind it. Everything structural is left behind, since the symbol
 * states its own box and is not a document.
 */
const STRUCTURAL = new Set([
  "xmlns",
  "xmlns:xlink",
  "version",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "id",
  "class",
  "data-name",
  "xml:space",
  "aria-hidden",
  "role"
])

const inherited = (svg: string): string => {
  const tag = /<svg[^>]*>/.exec(svg)?.[0] ?? ""

  return [...tag.matchAll(/([a-zA-Z_:][\w.:-]*)="([^"]*)"/g)]
    .filter(([, name = ""]) => !STRUCTURAL.has(name))
    .map(([, name, value]) => `${name}="${value}"`)
    .join(" ")
}

const viewBoxes = new Map<string, string>()
const hoisted: Array<string> = []
const symbols = [...wanted].sort().map((icon) => {
  const svg = readFileSync(new URL(`icons/${icon}.svg`, root), "utf8")
  const declared = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "0 0 24 24"
  const [minX = 0, minY = 0, width = 24, height = 24] = declared.split(/[\s,]+/).map(Number)
  const carried = inherited(svg)

  let body = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim()

  // Every id in the sheet carries its icon's name. They arrive as `a` and `b`
  // — Material's optimiser is thorough — and sixty icons in one document with
  // a gradient called `a` each is one icon painted and fifty-nine blank.
  body = body
    .replace(/id="([^"]+)"/g, (_, id: string) => `id="${icon}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${icon}-${id})`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_, attribute: string, id: string) =>
      `${attribute}="#${icon}-${id}"`
    )

  // Moved to the origin rather than left where it was drawn. Material Symbols
  // are cut from a box starting at y = -960, and a `use` of a symbol whose box
  // starts anywhere but zero draws the icon off its own edge: `json` and
  // `kotlin` rendered as nothing at all.
  const viewBox = `0 0 ${width} ${height}`
  const shift = minX === 0 && minY === 0 ? "" : `transform="translate(${-minX} ${-minY})"`
  const dressing = [carried, shift].filter((part) => part !== "").join(" ")
  if (dressing !== "") body = `<g ${dressing}>${body}</g>`

  // Gradients and masks live at the top of the sheet, not inside the symbol
  // that paints with them: a `use` clones a symbol into a shadow tree, and a
  // `fill="url(#…)"` in there does not always find a definition that was cloned
  // along with it. Kotlin — the one gradient in the set — rendered as nothing.
  for (const defs of body.match(/<defs>[\s\S]*?<\/defs>/g) ?? []) {
    hoisted.push(defs.replace(/^<defs>|<\/defs>$/g, ""))
    body = body.replace(defs, "")
  }

  viewBoxes.set(icon, viewBox)
  return `<symbol id="mi-${icon}" viewBox="${viewBox}">${body}</symbol>`
})

const remapped = (table: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(table).map(([key, icon]) => [
      key,
      { name: `mi-${icon}`, viewBox: viewBoxes.get(icon) ?? "0 0 24 24" }
    ])
  )

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none"><defs>${hoisted.join("")}</defs>${symbols.join("")}</svg>`

const source = `// Generated by scripts/build-tree-icons.ts. Do not edit by hand.
// ${symbols.length} icons from material-icon-theme, as one sprite of symbols.

export type TreeIcon = { readonly name: string; readonly viewBox: string }

export const MATERIAL_SPRITE = ${JSON.stringify(sheet)}

export const MATERIAL_FILE: TreeIcon = ${JSON.stringify({
  name: "mi-document",
  viewBox: viewBoxes.get("document") ?? "0 0 24 24"
})}

export const MATERIAL_BY_EXTENSION: Record<string, TreeIcon> = ${JSON.stringify(remapped(extensionIcon), null, 2)}

export const MATERIAL_BY_FILE_NAME: Record<string, TreeIcon> = ${JSON.stringify(remapped(nameIcon), null, 2)}
`

const out = new URL("../src/ui/materialIcons.generated.ts", import.meta.url)
writeFileSync(out, source)

console.log(`${symbols.length} icons, ${(sheet.length / 1024).toFixed(0)} KB of sprite`)
