/**
 * The words out of a fragment of GitHub's rendered markdown.
 *
 * Only ever used on a commit headline, which is one line of text in a div —
 * not a general HTML reader, and not asked to be one.
 *
 * Its own module because two payloads need it: a commit's own page and the list
 * of a branch's, both of which send a headline as markdown where they send no
 * plain one. Two copies of the same unescaping would drift, and would drift
 * silently, since a missed entity reads as a headline with `&amp;` in it rather
 * than as a failure.
 */
export const plainText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
