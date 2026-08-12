/**
 * GitHub's HTML, for the two payloads that still do not carry the markdown.
 *
 * The README on a repository home and a commit message body arrive already
 * rendered. Everything else on this interface is parsed by `Markdown`.
 */
export const GitHubHtml = ({ html }: { readonly html: string }) => (
  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
)
