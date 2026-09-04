/**
 * The pieces both Discussions parsers read, written once.
 *
 * Their list page and their discussion page print the same three things in different wrappers:
 * a category with a maintainer's emoji on it, an upvote count in an accessible label, and
 * neither page's markup for them is the other's. Before this file the list parser held all three
 * and the page parser reached across into it for one, which is the shape a shared piece takes
 * when nobody has given it a home yet.
 *
 * What is not here is anything either page alone knows: their row's own state words, their
 * thread's comments, and every selector that names one layout.
 */
import type { Category, Emoji } from "@/domain/discussions"
import { text } from "./outcome"

/** `…/discussions/categories/{slug}`, with whatever their filter appended left off. */
export const CATEGORY = /\/discussions\/categories\/([^/?#]+)/

/**
 * The emoji a maintainer put on a category, out of whichever element carries it.
 *
 * Given the element rather than told where to look, because the two pages hang it differently:
 * the list puts it in its own box beside the row, and the discussion page puts it inside the
 * category link itself.
 *
 * Two kinds because GitHub serves two. A stock emoji arrives as a `g-emoji` with the character
 * in it, and a custom one as an image whose `alt` is `:the-name:`.
 */
export const emojiIn = (within: Element | null): Emoji => {
  if (within === null) return { kind: "none" }

  const said = text(within.querySelector("g-emoji"))
  if (said !== "") return { kind: "text", text: said }

  const image = within.querySelector("img[alt^=':'], img.discussions-emoji-box")
  const url = image?.getAttribute("src") ?? ""
  if (url === "") return { kind: "none" }

  return { kind: "image", url, name: (image?.getAttribute("alt") ?? "").replace(/^:|:$/g, "") }
}

/**
 * The category, off the link that names it and the element that carries its emoji.
 *
 * Two elements and not one, for the same reason `emojiIn` takes what it is given: on the list
 * they are siblings, and on the discussion page the emoji is inside the link. The slug is taken
 * out of the href rather than made from the name, because the name is a maintainer's words and
 * the slug is GitHub's.
 */
export const categoryAt = (link: Element | null, emojiHolder: Element | null): Category => ({
  name: text(link),
  slug: decodeURIComponent(CATEGORY.exec(link?.getAttribute("href") ?? "")?.[1] ?? ""),
  emoji: emojiIn(emojiHolder)
})

/**
 * A vote count, out of the label GitHub writes on the button.
 *
 * `Upvote: 42`, which is the only place on either page the number is written in a form that does
 * not also change with the reader's own vote. Nothing, rather than a guess, where the label is
 * not theirs: a count is drawn as a number and a wrong number is worse than none.
 */
export const upvotesIn = (label: string): number => {
  const found = Number(/^Upvote:\s*(\d+)$/.exec(label)?.[1])
  return Number.isSafeInteger(found) && found >= 0 ? found : 0
}
