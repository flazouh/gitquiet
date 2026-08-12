import { hrefOf } from "./sanitize"

export const ALLOWED_TAGS = new Set(["a", "picture", "details", "summary", "source", "img", "br"])

const SKIP_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta"])

const VOID_TAGS = new Set(["br", "img", "source"])

const ATTRS: Readonly<Record<string, ReadonlySet<string>>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  source: new Set(["media", "srcset", "type"]),
  picture: new Set(),
  details: new Set(["open"]),
  summary: new Set(),
  br: new Set()
}

const URL_ATTRS = new Set(["href", "src"])

export type HtmlPiece =
  | { readonly kind: "open"; readonly tag: string; readonly attrs: Readonly<Record<string, string>> }
  | { readonly kind: "close"; readonly tag: string }
  | { readonly kind: "text"; readonly text: string }

export const piecesOf = (html: string): ReadonlyArray<HtmlPiece> => {
  const pieces: Array<HtmlPiece> = []
  const tag = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/?>/g
  let last = 0
  for (const match of html.matchAll(tag)) {
    const at = match.index
    if (at > last) pieces.push({ kind: "text", text: html.slice(last, at) })
    const raw = match[0]
    const name = match[1]?.toLowerCase() ?? ""
    if (raw.startsWith("</")) pieces.push({ kind: "close", tag: name })
    else {
      const attrs = attrsOf(match[2] ?? "")
      if (raw.endsWith("/>") || VOID_TAGS.has(name)) {
        pieces.push({ kind: "open", tag: name, attrs })
        pieces.push({ kind: "close", tag: name })
      } else {
        pieces.push({ kind: "open", tag: name, attrs })
      }
    }
    last = at + raw.length
  }
  if (last < html.length) pieces.push({ kind: "text", text: html.slice(last) })
  return pieces
}

export const isSkipped = (tag: string): boolean => SKIP_TAGS.has(tag)

export const isAllowed = (tag: string): boolean => ALLOWED_TAGS.has(tag)

export const attrsFor = (tag: string, attrs: Readonly<Record<string, string>>): Readonly<Record<string, string>> => {
  const allow = ATTRS[tag]
  if (allow === undefined) return {}
  const kept: Record<string, string> = {}
  for (const [name, value] of Object.entries(attrs)) {
    if (!allow.has(name)) continue
    if (URL_ATTRS.has(name)) {
      const safe = hrefOf(value)
      if (safe !== null) kept[name] = safe
      continue
    }
    if (name === "srcset") {
      const safe = srcsetOf(value)
      if (safe !== null) kept[name] = safe
      continue
    }
    kept[name] = value
  }
  return kept
}

const attrsOf = (raw: string): Readonly<Record<string, string>> => {
  const attrs: Record<string, string> = {}
  const pair = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  for (const match of raw.matchAll(pair)) {
    const name = match[1]?.toLowerCase()
    if (name === undefined) continue
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? ""
  }
  return attrs
}

const srcsetOf = (value: string): string | null => {
  const kept: Array<string> = []
  for (const part of value.split(",")) {
    const trimmed = part.trim()
    if (trimmed === "") continue
    const bits = trimmed.split(/\s+/u)
    const url = bits[0]
    if (url === undefined) continue
    const safe = hrefOf(url)
    if (safe === null) continue
    kept.push(bits.length > 1 ? `${safe} ${bits.slice(1).join(" ")}` : safe)
  }
  return kept.length === 0 ? null : kept.join(", ")
}
