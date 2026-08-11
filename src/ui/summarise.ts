/**
 * A picture, said in the words it was given.
 *
 * A comment that is one screenshot is written as an `img` tag — by their own box, and by this
 * one — and a folded line reading `<img width="1600" height="900" alt=…` is the tag rather than
 * the comment. The alt text is what somebody would say out loud about it.
 */
const asPicture = (line: string): string =>
  line.replace(/<img\b[^>]*>/gi, (tag) => {
    const alt = /\salt="([^"]*)"/i.exec(tag)?.[1]
    return alt === undefined || alt === "" ? "Image" : alt
  })

/** Markdown that carries no meaning once the line is one line of plain text. */
const asProse = (line: string): string =>
  asPicture(line)
    .replace(/^\s*[#>]{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    // Whatever else was written as a tag, GitHub allowing a handful of them in a comment.
    .replace(/<\/?[a-z][^>]*>/gi, "")
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
