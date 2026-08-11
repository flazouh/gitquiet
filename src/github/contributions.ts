import { Option } from "effect"

/**
 * How much somebody has done on GitHub in the last year.
 *
 * Their hovercard does not carry it, and it is the one thing a face cannot
 * suggest: a bio says who somebody thinks they are, a year's count says whether
 * the person about to review this has been here.
 *
 * The page it comes off is a quarter of a megabyte, nearly all of it the calendar
 * — three hundred and sixty-five cells and a tooltip for each. So the number is
 * cut out of the markup before anything parses it, which is why this reads a
 * string rather than a document.
 */

/** Where the calendar lives. Signed in, so the counts are the ones GitHub shows. */
export const contributionsRoute = (login: string): string =>
  `/users/${encodeURIComponent(login)}/contributions`

/**
 * The heading above the calendar, which is the total in words.
 *
 * An id rather than a shape or a class: this one is the anchor their own page
 * points `aria-describedby` at, so it is part of how the calendar is announced
 * rather than part of how it looks.
 */
const HEADING = 'id="js-contribution-activity-description"'

const CLOSED = "</h2>"

/**
 * The total, or nothing where the page has stopped saying it.
 *
 * Nothing rather than zero for a page that no longer parses, because zero is a
 * real answer — a new account has none — and a card that reports none for
 * somebody who simply could not be read would be lying quietly.
 */
export const contributionsIn = (html: string): Option.Option<number> => {
  const at = html.indexOf(HEADING)
  if (at === -1) return Option.none()

  const opens = html.lastIndexOf("<", at)
  const closes = html.indexOf(CLOSED, at)
  if (opens === -1 || closes === -1) return Option.none()

  const said = (
    new DOMParser().parseFromString(html.slice(opens, closes + CLOSED.length), "text/html").body
      .textContent ?? ""
  ).trim()

  // Somebody who has done nothing is told so in words, and none of it is a digit.
  if (said.startsWith("No contributions")) return Option.some(0)

  // The count leads, and what follows it is either "in the last year" or a year.
  // Anchored on the word rather than on digits, so the year is never read as part
  // of the number.
  const counted = /^([\d,]+)\s+contributions?\b/.exec(said)?.[1]
  return counted === undefined ? Option.none() : Option.some(Number(counted.replaceAll(",", "")))
}
