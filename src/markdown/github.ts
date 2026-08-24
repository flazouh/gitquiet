import { nameToEmoji } from "gemoji"
import { everyAddressIn } from "./html"
import type {
  AlertKind,
  Footnote,
  HtmlNode,
  MarkdownBlock,
  MarkdownDocument,
  MarkdownInline,
  ParseOptions
} from "./model"

const SHORTHAND = /([a-zA-Z0-9][a-zA-Z0-9._-]*)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)#(\d+)/g
const ISSUE = /#(\d+)/g
const MENTION = /@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/g
const EMOJI = /:([a-z0-9_+-]+):/g
const FOOTNOTE_REF = /\[\^([^\]]+)\]/g
const FOOTNOTE_DEF = /^\[\^([^\]]+)\]:\s*/
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*/i
const ALERT_KINDS = new Set<AlertKind>(["note", "tip", "important", "warning", "caution"])

export const decorateGitHub = (
  document: MarkdownDocument,
  options: ParseOptions
): MarkdownDocument => {
  const pulled = pullFootnotes(document.blocks)
  return {
    blocks: pulled.blocks.map((block) => decorateBlock(block, options)),
    footnotes: pulled.footnotes.map((note) => ({
      ...note,
      blocks: note.blocks.map((block) => decorateBlock(block, options))
    }))
  }
}

const pullFootnotes = (
  blocks: ReadonlyArray<MarkdownBlock>
): { blocks: ReadonlyArray<MarkdownBlock>; footnotes: ReadonlyArray<Footnote> } => {
  const kept: Array<MarkdownBlock> = []
  const footnotes: Array<Footnote> = []
  for (const block of blocks) {
    const note = footnoteDef(block)
    if (note === undefined) {
      kept.push(block)
      continue
    }
    footnotes.push(note)
  }
  return { blocks: kept, footnotes }
}

const footnoteDef = (block: MarkdownBlock): Footnote | undefined => {
  if (block.type !== "paragraph") return undefined
  const first = block.children[0]
  if (first === undefined || first.type !== "text") return undefined
  const match = FOOTNOTE_DEF.exec(first.text)
  if (match === null) return undefined
  const id = match[1]
  if (id === undefined) return undefined
  const rest = first.text.slice(match[0].length)
  const children: Array<MarkdownInline> =
    rest === "" ? [...block.children.slice(1)] : [{ type: "text", text: rest }, ...block.children.slice(1)]
  return {
    id,
    blocks: children.length === 0 ? [] : [{ type: "paragraph", children }]
  }
}

const decorateBlock = (block: MarkdownBlock, options: ParseOptions): MarkdownBlock => {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "text":
      return { ...block, children: decorateInlines(block.children, options) }
    case "blockquote": {
      const inner = { ...block, blocks: block.blocks.map((child) => decorateBlock(child, options)) }
      return asAlert(inner)
    }
    case "alert":
      return { ...block, blocks: block.blocks.map((child) => decorateBlock(child, options)) }
    case "list":
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          blocks: item.blocks.map((child) => decorateBlock(child, options))
        }))
      }
    case "table":
      return {
        ...block,
        header: block.header.map((cell) => ({
          ...cell,
          children: decorateInlines(cell.children, options)
        })),
        rows: block.rows.map((row) =>
          row.map((cell) => ({ ...cell, children: decorateInlines(cell.children, options) }))
        )
      }
    case "html":
      return decorateHtml(block, options)
    default:
      return block
  }
}

const RAW = "https://raw.githubusercontent.com"

/** An address that already says where it is: it has a scheme, or it starts at a root. */
const ROOTED = /^(?:[a-z][a-z0-9+.-]*:|\/)/iu

/**
 * A picture's address, read as a file in the repository the markdown came out of.
 *
 * A README writes `site/public/store/working-set.png`, meaning a file in the repository, and
 * GitHub's own rendering points that at their raw host. Left as written it resolves against
 * whatever page the reader is standing on, so every shot in every README is a missing page
 * drawn as a broken picture.
 *
 * `HEAD` where the caller named no branch: their raw host resolves it to the default branch,
 * so nothing here has to know what a repository calls its trunk.
 */
const inTheRepository = (src: string, options: ParseOptions): string => {
  const { owner, repo } = options
  if (owner === undefined || repo === undefined) return src
  if (src === "" || ROOTED.test(src)) return src
  /*
   * `URL` walks the `..` and the `./` for us, from the directory the file naming it is in,
   * and encodes the spaces a filename is allowed to have. It is the same walk a reader does
   * in their head reading `../site/one.png` in a file under `docs`, and writing it out by
   * hand was twenty lines saying what the platform already says.
   */
  const from = `${RAW}/${owner}/${repo}/${options.branch ?? "HEAD"}/${options.at ?? ""}`
  return new URL(src, from).toString()
}

/*
 * One walk for both, because a picture written as html arrives as a block on its own line and
 * as an inline in the middle of a sentence, and the two must not disagree about where its
 * file is.
 */
const decorateHtml = (node: HtmlNode, options: ParseOptions): HtmlNode => ({
  ...node,
  attrs: pointed(node, options),
  children: node.children.flatMap(
    (child): ReadonlyArray<MarkdownBlock | MarkdownInline> =>
      isInline(child) ? decorateInline(child, options) : [decorateBlock(child, options)]
  )
})

/**
 * The tag's own attributes, with any address in them read as a file in the repository.
 *
 * No tag is named here because none has to be: `html.ts` decides which tags may carry a `src`
 * or a `srcset` at all, and only a picture and its sources may.
 */
const pointed = (node: HtmlNode, options: ParseOptions): HtmlNode["attrs"] => {
  const src = node.attrs["src"]
  const srcset = node.attrs["srcset"]
  const each = srcset === undefined ? null : everyAddressIn(srcset, (one) => inTheRepository(one, options))
  return {
    ...node.attrs,
    ...(src === undefined ? {} : { src: inTheRepository(src, options) }),
    ...(each === null ? {} : { srcset: each })
  }
}

const asAlert = (block: Extract<MarkdownBlock, { type: "blockquote" }>): MarkdownBlock => {
  const first = block.blocks[0]
  if (first === undefined || first.type !== "paragraph") return block
  const firstInline = first.children[0]
  if (firstInline === undefined || firstInline.type !== "text") return block
  const match = ALERT.exec(firstInline.text)
  if (match === null) return block
  const rawKind = match[1]?.toLowerCase()
  if (rawKind === undefined || !ALERT_KINDS.has(rawKind as AlertKind)) return block
  const rest = firstInline.text.slice(match[0].length).replace(/^\n/u, "")
  const children: ReadonlyArray<MarkdownInline> =
    rest === "" ? first.children.slice(1) : [{ type: "text", text: rest }, ...first.children.slice(1)]
  const blocks =
    children.length === 0 ? block.blocks.slice(1) : [{ ...first, children }, ...block.blocks.slice(1)]
  return { type: "alert", kind: rawKind as AlertKind, blocks }
}

const decorateInlines = (
  nodes: ReadonlyArray<MarkdownInline>,
  options: ParseOptions
): ReadonlyArray<MarkdownInline> => nodes.flatMap((node) => decorateInline(node, options))

const decorateInline = (node: MarkdownInline, options: ParseOptions): ReadonlyArray<MarkdownInline> => {
  switch (node.type) {
    case "text":
      return splitText(node.text, options)
    case "link":
    case "strong":
    case "em":
    case "delete":
      return [{ ...node, children: decorateInlines(node.children, options) }]
    case "image":
      return [{ ...node, src: inTheRepository(node.src, options) }]
    case "html":
      return [decorateHtml(node, options)]
    default:
      return [node]
  }
}

const isInline = (node: MarkdownBlock | MarkdownInline): node is MarkdownInline => {
  switch (node.type) {
    case "heading":
    case "paragraph":
    case "table":
    case "list":
    case "blockquote":
    case "alert":
    case "hr":
    case "sources":
      return false
    case "code":
      return !("language" in node)
    case "text":
      return "text" in node
    default:
      return true
  }
}

const splitText = (text: string, options: ParseOptions): ReadonlyArray<MarkdownInline> => {
  const found: Array<{ start: number; end: number; node: MarkdownInline }> = []

  for (const match of text.matchAll(SHORTHAND)) {
    const owner = match[1]
    const repo = match[2]
    const number = match[3]
    if (owner === undefined || repo === undefined || number === undefined) continue
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      node: { type: "issue", owner, repo, number: Number(number), label: match[0] }
    })
  }

  if (options.owner !== undefined && options.repo !== undefined) {
    for (const match of text.matchAll(ISSUE)) {
      const number = match[1]
      if (number === undefined) continue
      const start = match.index
      const end = start + match[0].length
      if (overlaps(found, start)) continue
      found.push({
        start,
        end,
        node: {
          type: "issue",
          owner: options.owner,
          repo: options.repo,
          number: Number(number),
          label: match[0]
        }
      })
    }
  }

  for (const match of text.matchAll(MENTION)) {
    const login = match[1]
    if (login === undefined) continue
    const start = match.index
    if (start > 0) {
      const before = text[start - 1]
      if (before !== undefined && /[a-zA-Z0-9]/u.test(before)) continue
    }
    const end = start + match[0].length
    if (overlaps(found, start)) continue
    found.push({ start, end, node: { type: "mention", login } })
  }

  for (const match of text.matchAll(FOOTNOTE_REF)) {
    if (text[match.index + match[0].length] === ":") continue
    const id = match[1]
    if (id === undefined) continue
    const start = match.index
    if (overlaps(found, start)) continue
    found.push({
      start,
      end: start + match[0].length,
      node: { type: "footnote-ref", id }
    })
  }

  for (const match of text.matchAll(EMOJI)) {
    const name = match[1]
    if (name === undefined) continue
    const character = nameToEmoji[name]
    if (character === undefined) continue
    const start = match.index
    if (overlaps(found, start)) continue
    found.push({
      start,
      end: start + match[0].length,
      node: { type: "emoji", name, character }
    })
  }

  found.sort((left, right) => left.start - right.start)

  const nodes: Array<MarkdownInline> = []
  let cursor = 0
  for (const item of found) {
    if (item.start < cursor) continue
    if (item.start > cursor) nodes.push({ type: "text", text: text.slice(cursor, item.start) })
    nodes.push(item.node)
    cursor = item.end
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) })
  return nodes.length === 0 ? [{ type: "text", text }] : nodes
}

const overlaps = (
  found: ReadonlyArray<{ start: number; end: number }>,
  start: number
): boolean => found.some((item) => start >= item.start && start < item.end)
