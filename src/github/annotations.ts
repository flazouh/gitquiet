import { Option } from "effect"
import type { Check, CheckNote, CheckNoteLevel, LogSpot } from "../domain/PullRequest"

/**
 * The check run behind a check's link.
 *
 * GitHub's own link for an Actions check ends in the job it ran as, and that
 * number is also the id of the check run — the one their Checks tab asks for by
 * name. A check from anything other than Actions has a link somewhere else
 * entirely, which is why this can answer with nothing.
 */
export const checkRunIn = (check: Check): string | undefined =>
  /\/job\/(\d+)/.exec(check.url)?.[1]

/**
 * Their colour for each severity, and there are two spellings of the last one.
 *
 * A pull request's Checks tab draws a notice in the accent; a run's own page draws the
 * same note with `octicon-info` in `color-fg-muted`. Only the accent was listed, so
 * every notice on a run page fell through to the default and the worked run reported
 * ten notices as failures, in the failure colour, above the warning that was real.
 */
const LEVELS: ReadonlyArray<readonly [string, CheckNoteLevel]> = [
  ["color-fg-danger", "failure"],
  ["color-fg-attention", "warning"],
  ["color-fg-accent", "notice"],
  ["color-fg-muted", "notice"]
]

/**
 * What GitHub wrote against the check, read out of the page they wrote it on.
 *
 * This is scraping, and it is scraping on purpose: the log itself lives in
 * cloud storage behind a signed link a page may not read, and GitHub publishes
 * no route that answers with these in any other form. So we take the markup
 * their own Checks tab is built from, and take only the three things inside it
 * that survive a redesign in spirit if not in class name — the step, what it
 * said, and how bad it was.
 *
 * Written to come back empty rather than wrong. Every piece is optional, an
 * unrecognisable annotation is skipped rather than guessed at, and a page that
 * has stopped looking like this at all yields nothing — which the dialog can
 * say plainly.
 */
export const notesIn = (html: string): ReadonlyArray<CheckNote> => {
  const open = html.indexOf("<annotation-message")
  const close = html.lastIndexOf("</annotation-message>")
  if (open < 0 || close < open) return []

  // The checks document is hundreds of kilobytes. Only these custom elements
  // hold notes, so parsing the surrounding application shell blocks the page
  // for no result.
  const notes = html.slice(open, close + "</annotation-message>".length)
  const page = new DOMParser().parseFromString(notes, "text/html")

  return [...page.querySelectorAll("annotation-message")].flatMap((one) => {
    const message = text(one.querySelector('[data-target="annotation-message.annotationContainer"]'))
    if (message === "") return []

    return [
      {
        level: levelOf(one),
        where: text(one.querySelector("strong")),
        message,
        at: spotIn(one.querySelector("a")?.getAttribute("href") ?? "")
      }
    ]
  })
}

/**
 * The place in the log a note points at, out of the link GitHub puts on it.
 *
 * Their link reads `#annotation:4:43` on a pull request's Checks tab, which is step
 * four, line forty-three — the same step number their own log route is fetched by. On a
 * run's own page the identical thing is written `#step:5:54`. Both are followed, because
 * the note is the same note and the screen reading it should not care which of their
 * pages it came off. A note with no link of either shape belongs to no line we can find,
 * and says so.
 */
export const spotIn = (href: string): Option.Option<LogSpot> => {
  const found = /#(?:annotation|step):(\d+):(\d+)/.exec(href)
  if (found === null) return Option.none()

  return Option.some({ step: Number(found[1]), line: Number(found[2]) })
}

const text = (node: Element | null): string => (node?.textContent ?? "").trim()

/**
 * How bad it is, taken from the colour of the icon beside it.
 *
 * GitHub does not name the severity anywhere in this markup; the only thing
 * that distinguishes an error from a warning is which Primer colour class the
 * octicon wears. Anything unrecognised is treated as a failure, since these
 * only appear on checks that have something to complain about.
 */
const levelOf = (one: Element): CheckNoteLevel => {
  const classes = one.querySelector("svg")?.getAttribute("class") ?? ""
  return LEVELS.find(([name]) => classes.includes(name))?.[1] ?? "failure"
}
