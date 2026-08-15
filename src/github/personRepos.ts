/**
 * A person's repositories tab, read out of the document GitHub already served.
 *
 * Scraping, and here it costs nothing at all. Their page is Rails-rendered and every
 * row arrives complete: measured on 2026-08-14, `/flazouh?tab=repositories` is
 * 307 kilobytes holding thirty rows with the name, the description, the topics, the
 * language and its colour, the licence, the last push and — where the count is not
 * zero — the stars and the forks. So the first page of this screen is a read of the
 * document it is standing in, and the first request it makes is for page two.
 *
 * Every hook here was measured on three served pages rather than guessed:
 * `/flazouh?tab=repositories` for a small account, `/sindresorhus?tab=repositories`
 * for one whose rows carry star and fork counts, and `/tj?tab=repositories&type=archived`
 * for the archived rows the other two had none of. The archived flag is a class on
 * the row itself, `<li class="... public source archived">`, which is why it is read
 * structurally rather than off the "Public archive" label beside the name.
 *
 * Written to come back empty rather than wrong, as `actionsList.ts` and
 * `releasesList.ts` are. A row whose name cannot be read is skipped, so a page that
 * has stopped looking like this yields nothing and the screen hands the document
 * back to GitHub.
 */

import { Option } from "effect"
import type { ListedRepository } from "../domain/life"
import { text } from "./outcome"

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/** Their own list, which is the proof of which tab this is as well as the rows. */
const LIST = "#user-repositories-list"

/**
 * A count as their row words it, which is a number for a reader rather than for a
 * program: "5,217" on an English page, and grouped some other way on another.
 *
 * Every character that is not a digit comes out. That is deliberately blunt: a
 * thousands separator is a comma here, a full stop in German and a space in French,
 * and none of the three ever means a fraction in a count of stars.
 */
const countIn = (link: Element | null): number => {
  const said = text(link).replace(/\D/g, "")
  return said === "" ? 0 : Number(said)
}

/**
 * The colour GitHub paints the language, off the swatch beside its name.
 *
 * Read from their inline style rather than from a table of ours. They ship one colour
 * per language and a table here would be a second copy of it, wrong on whatever they
 * added last month — and wrong in a way nobody would notice for a year.
 */
const colourIn = (row: Element): string => {
  const swatch = row.querySelector(".repo-language-color")
  const said = swatch?.getAttribute("style") ?? ""
  return /background-color:\s*([^;]+)/.exec(said)?.[1]?.trim() ?? ""
}

const languageIn = (row: Element): ListedRepository["language"] => {
  const named = row.querySelector('[itemprop="programmingLanguage"]')
  const name = text(named)
  if (name === "") return Option.none()

  const colour = colourIn(row)
  // A language with no colour is still a language. Their swatch is a decoration and
  // the name is the fact, so a row that lost the style attribute keeps its name.
  return Option.some({ name, colour: colour === "" ? "currentColor" : colour })
}

/**
 * What this row is a fork of, where it is a fork.
 *
 * Their own sentence, "Forked from owner/repo", and the link in it is the parent. Read
 * from the link's text rather than from its address so that a parent renamed since the
 * fork was made reads as GitHub says it does now.
 */
const forkedFromIn = (row: Element): Option.Option<string> => {
  if (!row.classList.contains("fork")) return Option.none()

  const parent = row.querySelector('a.Link--muted[href^="/"]')
  const named = text(parent)
  return named === "" ? Option.none() : Option.some(named)
}

const repositoryIn = (row: Element): ReadonlyArray<ListedRepository> => {
  const named = row.querySelector('h3 a[href^="/"]')
  const url = named?.getAttribute("href") ?? ""
  const [owner, repo] = url.split("/").filter((part) => part.length > 0)
  if (owner === undefined || repo === undefined) return []

  const when = row.querySelector("relative-time[datetime]")
  const at = when?.getAttribute("datetime") ?? ""

  return [
    {
      owner,
      repo,
      nameWithOwner: `${owner}/${repo}`,
      description: Option.fromNullishOr(
        text(row.querySelector('[itemprop="description"]')) || null
      ),
      topics: [...row.querySelectorAll("a.topic-tag")].map((one) => text(one)),
      language: languageIn(row),
      /*
       * Absent where the count is zero, which is most rows on most accounts: GitHub
       * draws no star link at all rather than a link saying nothing. So a missing
       * link is a nought and never a failure to read one.
       */
      stars: countIn(row.querySelector('a[href$="/stargazers"]')),
      forks: countIn(row.querySelector('a[href$="/forks"]')),
      pushedAt: at === "" ? Option.none() : Option.some(at),
      /*
       * Their class on the row, not the label beside the name. Both say it, and the
       * label says it in the reader's own language — "Public archive" here, something
       * else on a page served in French — while the class is the same word on every
       * page GitHub serves.
       */
      isArchived: row.classList.contains("archived"),
      isFork: row.classList.contains("fork"),
      forkedFrom: forkedFromIn(row),
      isPrivate: row.classList.contains("private")
    }
  ]
}

/** Every row of one page of their list, in the order they gave them. */
export const repositoriesIn = (page: Document): ReadonlyArray<ListedRepository> =>
  [...page.querySelectorAll(`${LIST} li`)].flatMap(repositoryIn)

/** The same, for a page fetched rather than the one being stood on. */
export const repositoriesOnPage = (html: string): ReadonlyArray<ListedRepository> =>
  repositoriesIn(parse(html))

/**
 * Whether their pager offers a page after this one.
 *
 * Read off the pager rather than counted from the rows. Thirty rows is their page
 * size today and a screen that inferred "thirty means more" would ask for a page that
 * does not exist on every account with exactly thirty repositories — and stop asking
 * on the day they change the number.
 */
export const hasNextIn = (page: Document): boolean =>
  [...page.querySelectorAll(".paginate-container a[href]")].some(
    (link) => text(link).toLowerCase() === "next"
  )

export const hasNextOnPage = (html: string): boolean => hasNextIn(parse(html))

/**
 * Whether this document really is a person's repositories tab.
 *
 * Asked because the screen may be standing on a page GitHub has changed underneath
 * it, or on an organisation, whose address looks the same and whose markup is not.
 * The list element is the same hook the gate is proved with in `place.ts`, so the two
 * cannot disagree about what this page is.
 */
export const isTheirRepositories = (page: Document): boolean =>
  page.querySelector(LIST) !== null
