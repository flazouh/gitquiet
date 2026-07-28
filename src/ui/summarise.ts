/** Markdown that carries no meaning once the line is one line of plain text. */
const asProse = (line: string): string =>
  line
    .replace(/^\s*[#>]{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim()

/**
 * The first line of a comment that a person would read aloud.
 *
 * Review bots open every comment with an HTML comment carrying their own
 * bookkeeping, and people open theirs with a heading as often as not. Neither
 * is what the thread is about, and a list of either says nothing about any of
 * them.
 */
export const summarise = (body: string): string => {
  const withoutMarkers = body.replace(/<!--[\s\S]*?-->/g, "")
  const line = withoutMarkers.split("\n").map(asProse).find((candidate) => candidate.length > 0) ?? ""
  return line.length > 90 ? `${line.slice(0, 89)}…` : line
}
