/**
 * Who a person is, read out of the left column of the page GitHub already served.
 *
 * The same trade as `personRepos.ts` and it costs the same nothing: their page is
 * Rails-rendered, and the face, the name, the bio, the counts and every link they set
 * are all in the document before a single request of ours. So the column this
 * interface draws is drawn in the first frame, from markup that was already paid for.
 *
 * Every hook was measured on four fetched pages rather than guessed —
 * `/flazouh?tab=repositories` (a site and two socials), `/sindresorhus?tab=repositories`
 * (four socials), `/tj?tab=repositories&type=archived` (a company and no site) and
 * `/microsoft?tab=repositories` (an organisation, which has none of this markup at
 * all). Read by `itemprop` wherever GitHub sets one: those are schema.org names on a
 * page that says `itemtype="http://schema.org/Person"`, so they are the closest thing
 * to a contract this markup has, and they do not carry a per-deploy hash the way
 * Primer's class names do.
 *
 * Comes back empty rather than wrong, as every other reader here does. No login in the
 * column means this is not a person's page — an organisation shares the address — and
 * `Option.none()` is what makes the screen hand the document back to GitHub.
 */

import { Option } from "effect"
import type { Person, Way } from "../domain/person"
import { text } from "./outcome"

/**
 * Their own card, which is the proof as well as the content.
 *
 * `h-card` is a microformats class rather than a Primer one, and it wraps the whole
 * column. An organisation's page has no element with it, which is the measured
 * difference between the two pages this one address serves.
 */
const CARD = ".h-card"

/** A line of the card, by the schema.org name GitHub puts on it. */
const said = (card: Element, itemprop: string): Option.Option<string> => {
  const found = text(card.querySelector(`[itemprop="${itemprop}"]`))
  return found === "" ? Option.none() : Option.some(found)
}

/**
 * A link of theirs, as their page words it.
 *
 * Their label rather than the address, because a person who wrote `@sasha_zelts` on
 * their page is asking to be called that, and `https://x.com/sasha_zelts` in its place
 * is a longer way of saying it worse.
 */
const wayIn = (link: Element | null): Option.Option<Way> => {
  const href = link?.getAttribute("href") ?? ""
  const label = text(link)
  return href === "" || label === "" ? Option.none() : Option.some({ label, href })
}

/**
 * One line of the card, where the fact is on a child of the element that names it.
 *
 * `worksFor` holds a `.p-org` and `homeLocation` a `.p-label`, and both hold nothing
 * else — but where the inner element is missing the outer one still carries the words,
 * so this falls back to it rather than losing the line.
 */
const nested = (card: Element, itemprop: string, inside: string): Option.Option<string> => {
  const where = card.querySelector(`[itemprop="${itemprop}"]`)
  if (where === null) return Option.none()

  const found = text(where.querySelector(inside) ?? where)
  return found === "" ? Option.none() : Option.some(found)
}

/**
 * How many follow them, and how many they follow.
 *
 * Off the two links GitHub draws under the bio, by the tab each goes to rather than by
 * position: their order has changed before and a count read by position would silently
 * swap the two numbers rather than fail.
 */
const followIn = (card: Element, tab: string): Option.Option<string> => {
  const link = card.querySelector(`a[href*="tab=${tab}"] span.text-bold`)
  const found = text(link)
  return found === "" ? Option.none() : Option.some(found)
}

/**
 * The count on one of their own tabs, where that tab has one.
 *
 * Their nav is hidden by the gate rather than removed, so this reads the numbers a
 * reader was going to see anyway. `data-tab-item` is their hook and is on every one of
 * the eight; the profile tab carries no counter at all, which is why nothing here asks
 * for one.
 */
const tallyIn = (page: Document, tab: string): Option.Option<string> => {
  const found = text(page.querySelector(`a[data-tab-item="${tab}"] .Counter`))
  return found === "" ? Option.none() : Option.some(found)
}

/**
 * Their face, at the size the column draws it.
 *
 * Their big one first — the 260-pixel image inside the link to the full-sized file —
 * and the sticky bar's 32-pixel copy only if that is missing. Both are `img.avatar-user`
 * and the small one comes first in the document, so a reader of the markup who took the
 * first match would draw a thumbnail at four times its size on every page.
 */
const faceIn = (card: Element): Option.Option<string> => {
  const big = card.querySelector('[itemprop="image"] img')
  const any = card.querySelector("img.avatar-user")
  const src = (big ?? any)?.getAttribute("src") ?? ""
  return src === "" ? Option.none() : Option.some(src)
}

/**
 * Who a person's page says they are, or nothing where the page is not a person's.
 *
 * The bio is read as text rather than as their markup. GitHub renders `@mentions` and
 * emoji in it as elements, and a column that pasted their HTML into ours would carry
 * their type, their colours and their hovercard behaviour into a card of ours.
 */
export const personIn = (page: Document): Option.Option<Person> => {
  const card = page.querySelector(CARD)
  if (card === null) return Option.none()

  const login = text(card.querySelector(".vcard-username"))
  if (login === "") return Option.none()

  const sponsor = page.querySelector("#sponsor-profile-button")?.getAttribute("href") ?? ""

  return Option.some({
    login,
    name: said(card, "name"),
    /*
     * Their attribute rather than the text, where they set it. It is the bio as it was
     * typed, newlines and all, while the text of the element is the bio after their
     * renderer has been through it.
     */
    bio: Option.fromNullishOr(
      card.querySelector("[data-bio-text]")?.getAttribute("data-bio-text")?.trim() ||
        text(card.querySelector(".user-profile-bio")) ||
        null
    ),
    faceUrl: faceIn(card),
    company: nested(card, "worksFor", ".p-org"),
    location: nested(card, "homeLocation", ".p-label"),
    followers: followIn(card, "followers"),
    following: followIn(card, "following"),
    site: wayIn(card.querySelector('[itemprop="url"] a')),
    ways: [...card.querySelectorAll('[itemprop="social"] a, [itemprop="email"] a')].flatMap((link) =>
      Option.match(wayIn(link), { onNone: () => [], onSome: (way) => [way] })
    ),
    sponsorAt: sponsor === "" ? Option.none() : Option.some(sponsor),
    tally: {
      repositories: tallyIn(page, "repositories"),
      stars: tallyIn(page, "stars")
    }
  })
}
