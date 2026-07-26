import { OURS } from "./mount"

/**
 * Declares the bundled typeface at runtime, because a stylesheet cannot name it.
 *
 * A content script's CSS resolves its URLs against the page, not the extension:
 * `url("/fonts/InterVariable.woff2")` in our stylesheet asks github.com for a
 * font it has never heard of, gets their 404 page, and the face ends up in
 * status `error` with the interface quietly falling back. Only the extension
 * knows its own origin, and only at runtime, so the rule is written here with
 * the absolute URL rather than shipped in a file.
 *
 * Marked as ours so a later takeover of the same document leaves it standing.
 */
export const installFont = (target: Document, url: string): void => {
  const style = target.createElement("style")
  style.setAttribute(OURS, "")
  style.textContent = `@font-face {
  font-family: "InterVariable";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("${url}") format("woff2-variations");
}`
  target.head.append(style)
}
