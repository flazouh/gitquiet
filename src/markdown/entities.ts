/**
 * Text with its character references read: `&middot;` as `·`, `&#169;` as `©`.
 *
 * Marked keeps an entity as it was written, because its own renderer writes HTML
 * and the browser reads them there. We draw with React, which draws text as it is
 * given, so a README's `&middot;` was drawn as those eight characters.
 *
 * The browser's own table rather than a copy of it: a textarea's content is text,
 * never markup, so an entity that spells a tag comes back as the tag's letters. The
 * document is inert — nothing in it runs or loads — and one is made for the tab.
 * The library that carries the table is thirty-nine kilobytes; this is none.
 */
let pad: HTMLTextAreaElement | null = null

export const decodeEntities = (text: string): string => {
  if (!text.includes("&")) return text
  if (pad === null) {
    if (typeof document === "undefined") return text
    pad = document.implementation.createHTMLDocument("").createElement("textarea")
  }
  pad.innerHTML = text
  return pad.value
}
