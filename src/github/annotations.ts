import type { Check, CheckNote, CheckNoteLevel } from "../domain/PullRequest"

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

const LEVELS: ReadonlyArray<readonly [string, CheckNoteLevel]> = [
  ["color-fg-danger", "failure"],
  ["color-fg-attention", "warning"],
  ["color-fg-accent", "notice"]
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
  const page = new DOMParser().parseFromString(html, "text/html")

  return [...page.querySelectorAll("annotation-message")].flatMap((one) => {
    const message = text(one.querySelector('[data-target="annotation-message.annotationContainer"]'))
    if (message === "") return []

    return [
      {
        level: levelOf(one),
        where: text(one.querySelector("strong")),
        message
      }
    ]
  })
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
