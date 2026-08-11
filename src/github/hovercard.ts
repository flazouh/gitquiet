import { Option } from "effect"
import type { Portrait } from "../domain/portrait"

/**
 * The card GitHub draws when a reader hovers a face on their own pages.
 *
 * Scraping, and scraping for the same reason `annotations.ts` does it: there is
 * no route that answers with a person in any other form. `api.github.com` would,
 * and cannot be reached — github.com's own content policy refuses the connection,
 * and unauthenticated it would run out of requests halfway down a list of
 * twenty-five faces anyway.
 *
 * What makes this worth doing rather than fragile is that their fragment is built
 * out of labelled landmarks — `section[aria-label="User bio"]`, `address[aria-label
 * ="User location"]` — rather than out of divs. Those labels are what a screen
 * reader announces, so they are the last thing a redesign changes and the first
 * thing anyone would notice breaking.
 */

/** Where the card lives, optionally asked in the light of somewhere. */
export const hovercardRoute = (login: string, about: Option.Option<string>): string => {
  const asked = new URLSearchParams()
  if (Option.isSome(about)) asked.set("subject", about.value)

  const query = asked.toString()
  return `/users/${encodeURIComponent(login)}/hovercard${query === "" ? "" : `?${query}`}`
}

/** A repository as their card names one, which is by number and never by name. */
export const aboutRepository = (id: string): string => `repository:${id}`

const words = (node: Element | null | undefined): Option.Option<string> => {
  const said = (node?.textContent ?? "").trim()
  return said === "" ? Option.none() : Option.some(said)
}

/**
 * Their pronouns, which sit behind a separator rather than in a field.
 *
 * The login and the name are links; the pronouns are the one piece of that line
 * that is not, so they are read as the last plain span rather than by position.
 */
const pronounsIn = (card: Element): Option.Option<string> => {
  const line = card.querySelector('section[aria-label="User login and name"]')
  if (line === null) return Option.none()

  const spans = [...line.querySelectorAll("span")].filter(
    (span) => span.querySelector("a") === null && span.querySelector("span") === null
  )
  return words(spans.at(-1))
}

/**
 * Whether the reader follows them, read off which button is on offer.
 *
 * Both forms are always in the markup and the one that does not apply is hidden.
 * A visible Unfollow is the only place their card admits to the relationship.
 */
const following = (card: Element): boolean => {
  const forms = [...card.querySelectorAll("form.js-form-toggle-target")]
  const offered = forms.find((form) => !form.hasAttribute("hidden"))
  return (offered?.getAttribute("action") ?? "").includes("/users/unfollow")
}

/**
 * The person in the card, or nothing where there is no card.
 *
 * Nothing rather than a blank portrait, because the empty answer is real: an app
 * has no profile page, so `dependabot[bot]` and everything like it answers 404
 * and there is nothing to draw. Written the way `notesIn` is — every piece
 * optional, a shape that has stopped looking like this at all yields nothing —
 * so a GitHub redesign costs the card rather than the row it hangs off.
 */
export const portraitIn = (html: string, login: string): Option.Option<Portrait> => {
  const card = new DOMParser().parseFromString(html, "text/html").body

  const named = card.querySelector('section[aria-label="User login and name"]')
  if (named === null) return Option.none()

  return Option.some({
    login,
    // The second link on that line, the first being the login itself.
    name: words(named.querySelectorAll("a")[1]),
    pronouns: pronounsIn(card),
    bio: words(card.querySelector('section[aria-label="User bio"]')),
    location: words(card.querySelector('address[aria-label="User location"]')),
    faceUrl: Option.fromNullishOr(
      card.querySelector('section[aria-label="User avatar"] img')?.getAttribute("src")
    ),
    // Their one line sits beside an icon rather than in a landmark, so it is read
    // by the shape it always has: a condensed single line that does not wrap.
    note: words(card.querySelector("span.lh-condensed")),
    sponsorable: card.querySelector('a[href^="/sponsors/"]') !== null,
    followedByViewer: following(card)
  })
}
