import type { GistFile, GistSeen } from "../domain/gist"

/**
 * One gist, out of the markup GitHub already sent.
 *
 * Scraping, for the reason `actionsList.ts` gives about their Actions list: the page is
 * server-rendered and one fetch carries every file's content, its language, its raw
 * link and every count already on it. There is no JSON route beside it that answers
 * with anything this cannot read here.
 *
 * Written to come back empty rather than wrong. A page whose head cannot be read yields
 * nothing and the screen hands the document back to GitHub, which is the only honest
 * answer to markup that has stopped looking like this.
 */

/** The leading number out of a count link's own words — "6 forks", "4 revisions". */
const howMany = (said: string | null | undefined): number => {
  const found = /(\d[\d,]*)/.exec(said ?? "")
  return found === null ? 0 : Number(found[1]?.replaceAll(",", "") ?? 0)
}

/**
 * One file, told apart from the next by their `.file` block.
 *
 * The content is read off `.Box-body`'s own text rather than off a narrower selector
 * per kind. A rendered README and a highlighted source file share no markup at all, and
 * anything reading them separately is two selectors to keep and one to forget.
 */
const fileFrom = (element: Element): GistFile | null => {
  const name = element.querySelector(".gist-blob-name")?.textContent?.trim()
  if (name === undefined || name === "") return null

  const body = element.querySelector(".Box-body")
  const prose = element.querySelector(".markdown-body")
  const classes = body?.getAttribute("class") ?? ""
  const language = /\btype-([a-z0-9+#-]+)/i.exec(classes)?.[1] ?? null

  return {
    name,
    language,
    content: (body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim(),
    // Their own word for it: a file GitHub turned into HTML carries `markdown-body`,
    // and one it printed as lines does not.
    rendered: prose !== null,
    html: prose === null ? null : prose.innerHTML,
    raw:
      [...element.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .find((link) => link.textContent?.trim() === "Raw")
        ?.getAttribute("href") ?? null
  }
}

/**
 * Every count their head prints, each told apart by where its link points.
 *
 * By destination for the reason the list's reader gives: their head omits a count that
 * is zero on some pages and prints it on others, so reading by position reads whichever
 * one survived.
 */
const countsIn = (head: Element): Pick<
  GistSeen,
  "revisions" | "forks" | "stars" | "comments"
> => {
  const links = [...head.querySelectorAll<HTMLAnchorElement>("a[href]")]
  const at = (ending: string): number =>
    howMany(
      links.find((link) => (link.getAttribute("href") ?? "").endsWith(ending))?.textContent
    )

  return {
    revisions: at("/revisions"),
    forks: at("/forks"),
    stars: at("/stargazers"),
    comments: at("#comments")
  }
}

export const gistOnPage = (page: Document, owner: string, id: string): GistSeen | null => {
  const head = page.querySelector(".gisthead")
  if (head === null) return null

  const title = head.querySelector("h1 strong")?.textContent?.trim() ?? ""
  if (title === "") return null

  const files = [...page.querySelectorAll(".file")]
    .map(fileFrom)
    .filter((file): file is GistFile => file !== null)

  return {
    owner,
    id,
    title,
    /*
     * Their description, which is not on the head of every gist.
     *
     * Read off the muted span their `gist-snippet-meta` carries rather than off the
     * first muted span anywhere in the head, because the head's other muted span is the
     * "Last active" line and reading that as a description puts a date where the
     * sentence goes.
     */
    description:
      head.querySelector(".gist-snippet-meta .color-fg-muted")?.textContent?.trim() || null,
    secret: [...head.querySelectorAll(".Label")].some(
      (label) => label.textContent?.trim() === "Secret"
    ),
    updatedAt: head.querySelector("relative-time")?.getAttribute("datetime") ?? "",
    files,
    ...countsIn(head)
  }
}
