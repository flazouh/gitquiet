export type MarkdownProps = {
  /** GitHub's rendering of the body, taken from the same page's own endpoints. */
  readonly html: string
}

/**
 * A body of text exactly as GitHub renders it.
 *
 * Their HTML rather than their markdown, and their `markdown-body` class rather
 * than ours: task lists, suggestion blocks, mentions, emoji, footnotes,
 * collapsed sections and alerts are all GitHub extensions to markdown, they
 * have already rendered and sanitised them for this page, and reimplementing
 * that with a markdown library would be a worse copy of work already sitting in
 * the payload.
 */
export const Markdown = ({ html }: MarkdownProps) => (
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
)
