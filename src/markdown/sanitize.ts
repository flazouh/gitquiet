const BLOCKED = /^(?:javascript|data|file|blob|vbscript):/iu
const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:/iu

/**
 * An address a reader may follow, or nothing when the protocol is not safe.
 *
 * Markdown arrives from anyone who can open a pull request. A `javascript:`
 * link in that text must not become a clickable address in our tree.
 */
export const hrefOf = (href: string): string | null => {
  const trimmed = href.trim()
  if (trimmed === "") return null
  if (BLOCKED.test(trimmed)) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  if (HAS_PROTOCOL.test(trimmed) && !trimmed.startsWith("mailto:")) return null
  return trimmed
}
