import type { GistComment } from "../domain/gist"
import { postingOf, type Posting } from "./theirForm"

/**
 * What was said under a gist, out of the markup GitHub already sent.
 *
 * Their gist page is Rails, so the comments are on it in full — `.js-comment-container`
 * each, the way a discussion's are — and there is no JSON route beside it that says more.
 * Read off `PurpleBooth/109311bb0361f32d87a2` as served on 2026-09-06, which has a hundred
 * of them and the pager that comes with that many.
 */

const NAMED = /^gistcomment-(\d+)$/

/**
 * One comment, or nothing where the container holds none.
 *
 * The page carries one container that is not a comment: the box at the foot for writing
 * one sits in a `.js-comment-container` of its own. It has no `gistcomment-` name, so it
 * reads as nothing rather than as a comment by nobody.
 */
const commentFrom = (container: Element): GistComment | null => {
  const own = container.querySelector(".timeline-comment[id]")
  const id = NAMED.exec(own?.getAttribute("id") ?? "")?.[1]
  if (own === null || own === undefined || id === undefined) return null

  const login = own.querySelector("a.author")?.textContent?.trim() ?? ""
  if (login === "") return null

  /*
   * The face is beside the comment rather than in it, in their `TimelineItem-avatar`
   * column, which is why it is read off the container and not off the comment.
   */
  const face = container.querySelector<HTMLImageElement>("img.avatar-user")?.getAttribute("src")
  const html = own.querySelector(".js-comment-body")?.innerHTML ?? ""

  /*
   * The markdown as written, off the "Copy Markdown" entry of their own menu. It is the one
   * place their page keeps the source; the body is already rendered, and its text is the
   * source with every code fence and link flattened.
   */
  const body =
    [...own.querySelectorAll("clipboard-copy[value]")]
      .find((copy) => copy.textContent?.trim() === "Copy Markdown")
      ?.getAttribute("value") ?? (own.querySelector(".js-comment-body")?.textContent?.trim() ?? "")

  return {
    id,
    author: { login, faceUrl: face ?? null },
    body,
    html,
    createdAt: own.querySelector("relative-time")?.getAttribute("datetime") ?? ""
  }
}

/** Every comment in the given markup, oldest first, which is the order their page prints them. */
export const commentsOn = (root: ParentNode): ReadonlyArray<GistComment> =>
  [...root.querySelectorAll(".js-comment-container")]
    .map(commentFrom)
    .filter((comment): comment is GistComment => comment !== null)

/**
 * Where the comments a page held back can be read from, or nothing where it holds them all.
 *
 * Their pager is a GET form — `/load_comments` with the id of the oldest comment on the page
 * — and it answers with a fragment carrying the ones before it, and a pager of its own where
 * there are more. Read as an address so the same reader serves the page and every fragment.
 */
export const earlierCommentsIn = (root: ParentNode): string | null => {
  const form = root.querySelector("form.js-ajax-pagination")
  const action = form?.getAttribute("action") ?? ""
  if (form === null || form === undefined || action === "") return null

  const query = new URLSearchParams()
  for (const input of [...form.querySelectorAll("input[name]")]) {
    query.set(input.getAttribute("name") ?? "", input.getAttribute("value") ?? "")
  }

  return `${action}?${query.toString()}`
}

/**
 * The box at the foot of the page, for saying something under the gist.
 *
 * Nothing where the reader is not signed in, where GitHub draws "Sign in to comment" and
 * no form, and nothing where the owner turned comments off. A box that throws when it is
 * used is worse than no box.
 */
export const sayingOn = (page: Document): Posting | null =>
  postingOf(page.querySelector("form.js-new-comment-form"))
