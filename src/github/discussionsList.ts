/**
 * A repository's Discussions list page, read for every row on it.
 *
 * Scraping, and here it is not a preference. Their discussions list is the last large page on
 * github.com that is still served whole: read on 2026-09-03, `vercel/next.js/discussions` is
 * 547,066 bytes of Rails-rendered HTML with two React partials in it, the marketing header and
 * the keyboard-shortcuts dialog. There is no `payload` to decode and no persisted GraphQL query
 * on the page to borrow, so the rows are read where GitHub put them.
 *
 * What the row is read for is one fact GitHub prints and has no name for. Their row says
 * Answered or Unanswered, and Unanswered covers both a question nobody has replied to and a
 * question with nine replies and nothing marked. `answerable` and `answered` are reported here
 * exactly as their page words them, and `discussions.ts` draws the conclusion.
 *
 * Written to come back empty rather than wrong, as `actionsList.ts` and `releasesList.ts` are.
 * A row whose number cannot be read is skipped rather than guessed at, so a page that has
 * stopped looking like this yields nothing and the screen hands the document back to GitHub.
 *
 * Measured against `tests/fixtures/discussionsList.html`, which is `vercel/next.js` as GitHub
 * served it on 2026-09-03.
 */

import type { Category, DiscussionRef, Emoji, ListedDiscussion } from "../domain/discussions"
import { text } from "./outcome"

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/**
 * The address a row's heading links, in either of the two shapes GitHub uses.
 *
 * `/{owner}/{repo}/discussions/{number}` for a repository's, and
 * `/orgs/{org}/discussions/{number}` for an organisation's. The second is where GitHub runs its
 * own product feedback, and its rows are otherwise identical to a repository's — which is why one
 * pattern reads both rather than two parsers reading one each.
 */
const ROW = /^\/([^/]+)\/([^/]+)\/discussions\/(\d+)$/

/** Their own name for the discussion, off the id the upvote button carries. */
const UPVOTE_ID = /^discussion-upvote-button-Discussion-(.+)$/

/** `…/discussions/categories/{slug}`, with whatever their filter appended left off. */
const CATEGORY = /\/discussions\/categories\/([^/?#]+)/

/**
 * The words their row prints after the category, which is the only place the state is spelled.
 *
 * Anchored to their separator so that a discussion titled "Unanswered questions pile up" is not
 * read as unanswered. The separator is a middle dot in their own markup, and a closed Question
 * carries two of them: "· Closed · Unanswered".
 */
const ANSWERING = /·\s*(Answered|Unanswered)/

const CLOSED = /·\s*Closed\b/

/** "9 comments: ShivamArora, 08:29AM on September 17, 2024", which is the count's own label. */
const COMMENTS = /^(\d+)\s+comments?:/

const numberIn = (label: string, pattern: RegExp): number => {
  const said = pattern.exec(label)?.[1]
  const found = Number(said)
  return Number.isSafeInteger(found) && found >= 0 ? found : 0
}

/**
 * The picture a category wears, out of whichever of the two elements GitHub used for it.
 *
 * An ordinary emoji is a character inside a `g-emoji`. One of GitHub's own is an `<img>` with
 * the name in its `alt`, because `:shipit:` is a picture rather than a character. Reading only
 * the first drew `vercel/next.js`'s Show and tell with a blank where every other row has one.
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
 * The category the row was asked in.
 *
 * The emoji is read off their own box rather than mapped from the name. A maintainer chose it,
 * it is the one thing on their row that separates a Poll from a support question at a glance,
 * and there is no icon in the Octicon set that means "Turbopack error report".
 */
const categoryIn = (row: Element): Category => {
  const link = row.querySelector('a[aria-label$="(category)"][href]')
  const url = link?.getAttribute("href") ?? ""

  return {
    name: text(link),
    slug: decodeURIComponent(CATEGORY.exec(url)?.[1] ?? ""),
    emoji: emojiIn(row.querySelector(".bg-discussions-row-emoji-box"))
  }
}

/**
 * Everyone their avatar stack names, in the order they drew them.
 *
 * Their page draws the stack twice, once for a wide window and once for a narrow one, and only
 * the wide copy labels the images. So the labelled ones are read and the duplicates fall out
 * with them, rather than being de-duplicated afterwards by name.
 */
const participantsIn = (row: Element): ReadonlyArray<string> => {
  const named = [...row.querySelectorAll('img[aria-label$="(participant)"]')]
  return named.flatMap((one) => {
    const said = one.getAttribute("aria-label") ?? ""
    const who = said.replace(/\s*\(participant\)$/, "")
    return who === "" ? [] : [who]
  })
}

const referenceIn = (url: string): DiscussionRef | null => {
  const named = ROW.exec(url)
  if (named === null) return null

  const first = named[1] ?? ""
  const second = named[2] ?? ""
  const number = Number(named[3])
  if (first === "" || second === "" || !Number.isSafeInteger(number)) return null

  return {
    home:
      first === "orgs"
        ? { kind: "organisation", org: second }
        : { kind: "repository", owner: first, repo: second },
    number
  }
}

const discussionIn = (row: Element): ReadonlyArray<ListedDiscussion> => {
  const heading = row.querySelector("h3 a[href], h4 a[href]")
  const url = heading?.getAttribute("href") ?? ""
  const reference = referenceIn(url)
  if (reference === null) return []

  /*
   * Their own name for the discussion, and it is only ever on the vote button. A locked row has
   * no vote button: GitHub replaces the whole control with a lock in the same pill, so the id and
   * the count both go with it. Empty rather than dropped, because a locked discussion takes no
   * writes anyway and the row is still worth drawing. Requiring the id here lost every locked row
   * on the page.
   */
  const upvote = row.querySelector('button[id^="discussion-upvote-button-Discussion-"]')
  const id = UPVOTE_ID.exec(upvote?.getAttribute("id") ?? "")?.[1] ?? ""

  /*
   * The state, off their word rather than off their icon. Both are on the row: the icon beside
   * the count is `check-circle-fill` in `color-fg-success` when a reply is marked and
   * `check-circle` in `color-fg-muted` when none is. The word is read because it is the thing
   * that carries meaning rather than the thing that carries colour, and because a class list is
   * the part of their markup that changes most often.
   */
  const said = ANSWERING.exec(row.textContent ?? "")?.[1]

  const count = row.querySelector('a[aria-label*="comment"]')
  const author = row.querySelector('a[aria-label$="(author)"]')
  const when = row.querySelector("relative-time[datetime]")

  return [
    {
      reference,
      id,
      title: text(heading),
      url,
      category: categoryIn(row),
      /*
       * Whether the category takes answers. Their page prints one of the two words on every row
       * of an answerable category and neither word on any other, so the absence of both is the
       * fact rather than a gap in the read. Six of `vercel/next.js`'s nine categories are in
       * that state, and an Idea is not an unanswered question.
       */
      answerable: said !== undefined,
      answered: said === "Answered",
      /*
       * Closing came to discussions after answers did, and their row prints both words rather
       * than replacing one with the other. A closed Idea carries "· Closed" and no answer word
       * at all, so this is read off the sentence and not off the absence of the other two.
       */
      closed: CLOSED.test(row.textContent ?? ""),
      locked: row.querySelector(".octicon-lock") !== null,
      upvotes: numberIn(upvote?.getAttribute("aria-label") ?? "", /^Upvote:\s*(\d+)$/),
      comments: numberIn(count?.getAttribute("aria-label") ?? "", COMMENTS),
      /*
       * Their own `data-name`, which is the label's name without the colour swatch and the
       * whitespace their markup wraps it in. Read off the attribute rather than the text for
       * that reason alone.
       */
      labels: [...row.querySelectorAll("a.IssueLabel[data-name]")].flatMap((one) => {
        const name = one.getAttribute("data-name") ?? ""
        return name === "" ? [] : [name]
      }),
      author: text(author),
      askedAt: when?.getAttribute("datetime") ?? "",
      participants: participantsIn(row)
    }
  ]
}

/**
 * Every discussion their list page carries, in the order they gave them.
 *
 * Their order is kept and never re-sorted here, exactly as the releases parser keeps theirs.
 * Whether the screen groups these rows by Court is the screen's opinion to hold, and a parser
 * is the wrong place for it.
 */
export const discussionsOnPage = (html: string): ReadonlyArray<ListedDiscussion> =>
  [...parse(html).querySelectorAll("li.js-navigation-item")].flatMap(discussionIn)

/**
 * Whether their page says there is another one after this.
 *
 * Off their own next link rather than counted from the rows. Twenty-five rows is their page
 * size and also what the last page holds one time in twenty-five, and being wrong about it
 * means a Next that leads to nothing.
 */
export const hasMoreAfter = (html: string): boolean =>
  parse(html).querySelector('.paginate-container a[rel~="next"]') !== null

/**
 * Every category their sidebar names, for the filter this screen draws.
 *
 * Read off the sidebar rather than collected from the rows: a category nobody has posted in
 * yet has no row and is still a category, and the first page of a busy repository never
 * mentions more than a handful of the nine.
 */
export const categoriesOnPage = (html: string): ReadonlyArray<Category> => {
  const found = new Map<string, Category>()
  const items = parse(html).querySelectorAll(
    '.ActionList-item a[href*="/discussions/categories/"]'
  )

  for (const link of [...items]) {
    const url = link.getAttribute("href") ?? ""
    const slug = decodeURIComponent(CATEGORY.exec(url)?.[1] ?? "")

    /*
     * Their own label element rather than the anchor's whole text. The emoji sits in a sibling
     * span inside the same anchor, so reading the anchor gives "🏎️ App Router" with their
     * indentation between the two, and every category would then be named after its picture.
     */
    const name = text(link.querySelector(".ActionList-item-label")).replace(/\s+/g, " ")
    if (slug === "" || name === "" || found.has(slug)) continue

    found.set(slug, { name, slug, emoji: emojiIn(link) })
  }

  return [...found.values()]
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard the Actions and Releases lists keep, and for the same reason: an entry written
 * before an update is the one shape that would reach the screen and fail there. One row is
 * enough to tell, since they are written in one go by one version of this code, and
 * `answerable` is the field to prove because it is the one the grouping is built on.
 */
export const isKeptDiscussions = (value: unknown): value is ReadonlyArray<ListedDiscussion> => {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true

  const one: Partial<ListedDiscussion> = value[0]
  return (
    typeof one === "object" &&
    one !== null &&
    typeof one.id === "string" &&
    typeof one.title === "string" &&
    typeof one.answerable === "boolean" &&
    typeof one.answered === "boolean" &&
    typeof one.comments === "number" &&
    Array.isArray(one.labels) &&
    typeof one.category === "object"
  )
}

/**
 * Whether a whole page of discussions came back out of the store as it went in.
 *
 * Beside {@link isKeptDiscussions} because both are claims about what this file writes, and the
 * gateway then needs no cast: an entry written before the shape carried its categories would
 * answer `undefined` for them and empty the filter, so the entry is refused whole.
 */
export const isKeptFound = (
  value: unknown
): value is {
  readonly rows: ReadonlyArray<ListedDiscussion>
  readonly categories: ReadonlyArray<Category>
  readonly more: boolean
} => {
  if (typeof value !== "object" || value === null) return false

  const kept: Record<string, unknown> = { ...value }
  return (
    isKeptDiscussions(kept.rows) &&
    Array.isArray(kept.categories) &&
    typeof kept.more === "boolean"
  )
}
