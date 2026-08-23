import { marked, type Token, type Tokens } from "marked"
import { attrsFor, isAllowed, isSkipped, piecesOf, type HtmlPiece } from "./html"
import { decorateGitHub } from "./github"
import type {
  CodeBlock,
  HeadingBlock,
  HtmlNode,
  ListBlock,
  MarkdownBlock,
  MarkdownDocument,
  MarkdownInline,
  ParagraphBlock,
  ParseOptions,
  TableAlign,
  TableBlock,
  TableCell,
  TextBlock
} from "./model"
import { hrefOf } from "./sanitize"

/**
 * Parsed documents already used in this tab.
 *
 * A Back navigation remounts the screen, but its markdown and address context
 * are unchanged. Keeping the immutable model avoids running Marked and GitHub's
 * address decoration again before React can draw the remembered page.
 */
const HOW_MANY = 48
const documents = new Map<string, MarkdownDocument>()

const documentKey = (source: string, options: ParseOptions): string =>
  JSON.stringify([
    source,
    options.owner ?? null,
    options.repo ?? null,
    options.branch ?? null,
    options.at ?? null
  ])

export const parseMarkdown = (
  source: string,
  options: ParseOptions = {}
): MarkdownDocument => {
  const key = documentKey(source, options)
  const had = documents.get(key)
  if (had !== undefined) {
    documents.delete(key)
    documents.set(key, had)
    return had
  }

  const tokens = marked.lexer(source, { gfm: true, breaks: false })
  const document = decorateGitHub({ blocks: blocksOf(tokens), footnotes: [] }, options)
  documents.set(key, document)

  const oldest = documents.keys().next()
  if (documents.size > HOW_MANY && !oldest.done) documents.delete(oldest.value)
  return document
}

type Child = MarkdownBlock | MarkdownInline

type Frame =
  | {
      readonly kind: "html"
      readonly tag: string
      readonly attrs: Readonly<Record<string, string>>
      readonly children: Array<Child>
    }
  | { readonly kind: "unwrap"; readonly children: Array<Child> }
  | { readonly kind: "skip"; readonly tag: string }

const withHtml = (onRoot: (child: Child) => void) => {
  const stack: Array<Frame> = []

  const emit = (child: Child) => {
    const top = stack[stack.length - 1]
    if (top !== undefined && top.kind !== "skip") {
      top.children.push(child)
      return
    }
    onRoot(child)
  }

  const close = (tag: string) => {
    const match = isSkipped(tag) || isAllowed(tag)
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      const frame = stack[index]
      if (frame === undefined) continue
      if (match && frame.kind === "skip" && frame.tag === tag) {
        stack.length = index
        return
      }
      if (match && frame.kind === "html" && frame.tag === tag) {
        while (stack.length - 1 > index) {
          const above = stack.pop()
          if (above?.kind === "unwrap") {
            for (const child of above.children) frame.children.push(child)
          } else if (above?.kind === "html") {
            const node = htmlOf(above)
            if (node !== undefined) frame.children.push(node)
          }
        }
        stack.pop()
        const node = htmlOf(frame)
        if (node !== undefined) emit(node)
        return
      }
      if (!match && frame.kind === "unwrap") {
        stack.length = index
        for (const child of frame.children) emit(child)
        return
      }
    }
  }

  const html = (raw: string) => applyHtml(piecesOf(raw), stack, emit, close)

  const skipping = () => stack[stack.length - 1]?.kind === "skip"

  const flush = () => {
    while (stack.length > 0) {
      const frame = stack.pop()
      if (frame === undefined || frame.kind === "skip") continue
      if (frame.kind === "unwrap") {
        for (const child of frame.children) emit(child)
        continue
      }
      const node = htmlOf(frame)
      if (node !== undefined) emit(node)
    }
  }

  return { emit, html, skipping, flush }
}

const blocksOf = (tokens: ReadonlyArray<Token>): ReadonlyArray<MarkdownBlock> => {
  const out: Array<MarkdownBlock> = []
  const html = withHtml((child) => {
    if (isBlockChild(child)) {
      out.push(child)
      return
    }
    out.push({ type: "paragraph", children: [child] })
  })

  for (const token of tokens) {
    if (token.type === "space") continue
    if (token.type === "html" && "raw" in token) {
      html.html(token.raw)
      continue
    }
    if (html.skipping()) continue
    const block = blockOf(token)
    if (block !== undefined) html.emit(block)
  }

  html.flush()
  return out
}

const isBlockChild = (child: Child): child is MarkdownBlock => {
  switch (child.type) {
    case "heading":
    case "paragraph":
    case "table":
    case "list":
    case "blockquote":
    case "alert":
    case "hr":
    case "html":
      return true
    case "code":
      return "language" in child
    case "text":
      return "children" in child
    default:
      return false
  }
}

const applyHtml = (
  pieces: ReadonlyArray<HtmlPiece>,
  stack: Array<Frame>,
  emit: (child: MarkdownBlock | MarkdownInline) => void,
  close: (tag: string) => void
) => {
  for (const piece of pieces) {
    if (stack[stack.length - 1]?.kind === "skip") {
      if (piece.kind === "close") close(piece.tag)
      continue
    }
    if (piece.kind === "text") {
      if (piece.text.trim() === "") continue
      emit({ type: "text", text: piece.text })
      continue
    }
    if (piece.kind === "close") {
      close(piece.tag)
      continue
    }
    if (isSkipped(piece.tag)) {
      stack.push({ kind: "skip", tag: piece.tag })
      continue
    }
    if (!isAllowed(piece.tag)) {
      stack.push({ kind: "unwrap", children: [] })
      continue
    }
    stack.push({
      kind: "html",
      tag: piece.tag,
      attrs: attrsFor(piece.tag, piece.attrs),
      children: []
    })
  }
}

const htmlOf = (frame: Extract<Frame, { kind: "html" }>): HtmlNode | undefined => {
  if (frame.tag === "img" && frame.attrs.src === undefined) return undefined
  return { type: "html", tag: frame.tag, attrs: frame.attrs, children: frame.children }
}

const blockOf = (token: Token): MarkdownBlock | undefined => {
  switch (token.type) {
    case "heading":
      return isHeading(token) ? headingOf(token) : undefined
    case "paragraph":
      return isParagraph(token) ? paragraphOf(token) : undefined
    case "table":
      return isTable(token) ? tableOf(token) : undefined
    case "list":
      return isList(token) ? listOf(token) : undefined
    case "text":
      return isText(token) ? textBlockOf(token) : undefined
    case "code":
      return isCode(token) ? codeOf(token) : undefined
    case "blockquote":
      return isBlockquote(token) ? blockquoteOf(token) : undefined
    case "hr":
      return { type: "hr" }
    default:
      return undefined
  }
}

const headingOf = (token: Tokens.Heading): HeadingBlock => ({
  type: "heading",
  depth: depthOf(token.depth),
  children: inlinesOf(token.tokens)
})

const paragraphOf = (token: Tokens.Paragraph): ParagraphBlock => ({
  type: "paragraph",
  children: inlinesOf(token.tokens)
})

const tableOf = (token: Tokens.Table): TableBlock => ({
  type: "table",
  header: token.header.map((cell, index) => cellOf(cell, token.align[index] ?? null)),
  rows: token.rows.map((row) =>
    row.map((cell, index) => cellOf(cell, token.align[index] ?? null))
  )
})

const cellOf = (cell: Tokens.TableCell, align: TableAlign): TableCell => ({
  align,
  children: inlinesOf(cell.tokens)
})

const listOf = (token: Tokens.List): ListBlock => ({
  type: "list",
  ordered: token.ordered,
  start: typeof token.start === "number" ? token.start : null,
  items: token.items.map((item) => ({
    task: item.task,
    checked: item.checked ?? null,
    blocks: blocksOf(item.tokens)
  }))
})

const textBlockOf = (token: Tokens.Text): TextBlock => ({
  type: "text",
  children:
    token.tokens !== undefined ? inlinesOf(token.tokens) : [{ type: "text", text: token.text }]
})

const codeOf = (token: Tokens.Code): CodeBlock => {
  const info = token.lang ?? ""
  const space = info.search(/\s/u)
  return {
    type: "code",
    code: token.text,
    language: space === -1 ? info : info.slice(0, space),
    meta: space === -1 ? "" : info.slice(space + 1).trim()
  }
}

const depthOf = (depth: number): HeadingBlock["depth"] => {
  if (depth <= 1) return 1
  if (depth >= 6) return 6
  return depth as 2 | 3 | 4 | 5
}

const inlinesOf = (tokens: ReadonlyArray<Token> | undefined): ReadonlyArray<MarkdownInline> => {
  if (tokens === undefined) return []
  const inlines: Array<MarkdownInline> = []
  const html = withHtml((child) => {
    if (isBlockChild(child) && child.type !== "html") return
    inlines.push(child as MarkdownInline)
  })

  for (const token of tokens) {
    if (token.type === "html" && "raw" in token) {
      html.html(token.raw)
      continue
    }
    if (html.skipping()) continue
    for (const inline of inlineOf(token)) html.emit(inline)
  }

  html.flush()
  return inlines
}

const inlineOf = (token: Token): ReadonlyArray<MarkdownInline> => {
  switch (token.type) {
    case "text":
      if (!("text" in token)) return []
      if (Array.isArray(token.tokens)) return inlinesOf(token.tokens)
      return [{ type: "text", text: token.text }]
    case "escape":
      return "text" in token ? [{ type: "text", text: token.text }] : []
    case "link":
      return isLink(token) ? [linkOf(token)] : []
    case "image":
      return isImage(token) ? imageOf(token) : []
    case "strong":
      return Array.isArray(token.tokens)
        ? [{ type: "strong", children: inlinesOf(token.tokens) }]
        : []
    case "em":
      return Array.isArray(token.tokens) ? [{ type: "em", children: inlinesOf(token.tokens) }] : []
    case "del":
      return Array.isArray(token.tokens)
        ? [{ type: "delete", children: inlinesOf(token.tokens) }]
        : []
    case "codespan":
      return "text" in token ? [{ type: "code", text: token.text }] : []
    default:
      return []
  }
}

const isHeading = (token: Token): token is Tokens.Heading =>
  token.type === "heading" && "depth" in token && Array.isArray(token.tokens)

const isParagraph = (token: Token): token is Tokens.Paragraph =>
  token.type === "paragraph" && Array.isArray(token.tokens)

const isTable = (token: Token): token is Tokens.Table =>
  token.type === "table" && Array.isArray(token.header) && Array.isArray(token.rows)

const isList = (token: Token): token is Tokens.List =>
  token.type === "list" && Array.isArray(token.items)

const isText = (token: Token): token is Tokens.Text => token.type === "text" && "text" in token

const isCode = (token: Token): token is Tokens.Code => token.type === "code" && "text" in token

const isBlockquote = (token: Token): token is Tokens.Blockquote =>
  token.type === "blockquote" && Array.isArray(token.tokens)

const blockquoteOf = (token: Tokens.Blockquote): MarkdownBlock => ({
  type: "blockquote",
  blocks: blocksOf(token.tokens)
})

const isLink = (token: Token): token is Tokens.Link =>
  token.type === "link" && "href" in token && Array.isArray(token.tokens)

const linkOf = (token: Tokens.Link): MarkdownInline => ({
  type: "link",
  href: hrefOf(token.href),
  children: inlinesOf(token.tokens)
})

const isImage = (token: Token): token is Tokens.Image =>
  token.type === "image" && "href" in token && "text" in token

/*
 * Nothing rather than a broken picture where the address is not one a reader may follow.
 * A link with the same address keeps its words and loses only the press, because the words
 * are the message; an image's message is the picture, and there is nothing left to draw.
 */
const imageOf = (token: Tokens.Image): ReadonlyArray<MarkdownInline> => {
  const src = hrefOf(token.href)
  return src === null ? [] : [{ type: "image", src, alt: token.text }]
}
