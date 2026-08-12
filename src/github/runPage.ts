/**
 * A run's own page, read for everything the screen opens with.
 *
 * This is scraping, and it is scraping on purpose. Their run page is server-rendered
 * Turbo, and it carries the run's facts, all twelve jobs and all fifteen annotations in
 * the HTML it is served as, so one fetch answers the reader's question. The JSON routes
 * beside it (`navigation_partial`, `job_groups_batch`) hold a subset of the same jobs
 * and nothing else, so asking them as well would be two round trips for less.
 *
 * Written to come back empty rather than wrong, the same way `annotations.ts` is. Every
 * piece is optional, an unrecognisable job is skipped rather than guessed at, and a page
 * that has stopped looking like this at all yields nothing, which the screen can say
 * plainly before handing the document back to GitHub.
 *
 * Targets what a reader sees rather than what a class is called wherever there is a
 * choice: the outcome comes off the icon's own `aria-label`, the run's facts come off the
 * words "Status" and "Total duration" that the page prints beside them. Both survive a
 * redesign in spirit if not in markup. The routes and elements are recorded, measured, in
 * `scripts/probe-run-dom.js`.
 */

import type { CheckState } from "../domain/PullRequest"
import {
  type Job,
  type Presses,
  type Pressing,
  type Run,
  type RunOpening,
  gathered,
  tolerating
} from "../domain/run"
import { notesIn } from "./annotations"
import { secondsIn, stateOf, text } from "./outcome"

/**
 * The value the page prints beside one of its own labels.
 *
 * Their summary grid is a row of label-then-value pairs with no name on either, so the
 * label is the handle: find the muted span whose words are "Total duration", take what
 * sits next to it. Reading the nth child of a class instead would break the first time
 * they add a field, and they added Artifacts.
 */
const beside = (page: Document, label: string): string => {
  for (const said of page.querySelectorAll("span")) {
    if (text(said) !== label) continue
    const value = said.nextElementSibling
    if (value !== null) return text(value)
  }
  return ""
}

/** Their outcome icon for the run as a whole, which sits in the page header. */
const headerState = (page: Document): CheckState | null => {
  const icon = page.querySelector(".PageHeader-leadingVisual svg[aria-label]")
  const label = icon?.getAttribute("aria-label")
  return label === null || label === undefined ? null : stateOf(label)
}

/**
 * Which of their events started it, out of the sentence they print.
 *
 * They write "Triggered via pull request" and then a time, so the words between the
 * two are the trigger. Their own wording is kept rather than mapped to an event name:
 * a reader who saw "pull request" on their page should read "pull request" here.
 */
const triggerIn = (page: Document): { readonly trigger: string; readonly startedAt: string } => {
  for (const said of page.querySelectorAll("span")) {
    const words = text(said)
    if (!words.startsWith("Triggered via ")) continue
    const when = said.querySelector("relative-time")?.getAttribute("datetime") ?? ""
    const sentence = when === "" ? words : words.slice(0, words.indexOf(text(said.querySelector("relative-time"))))
    return { trigger: sentence.replace("Triggered via ", "").trim(), startedAt: when }
  }
  return { trigger: "", startedAt: "" }
}

/**
 * The run's own facts, or nothing where the page is not a run's.
 *
 * Nothing when the workflow or the outcome cannot be read, since those two are what
 * every other field is reported against. A screen with neither has nothing to draw and
 * should hand the document back.
 */
export const runFrom = (html: string): Run | null => {
  const page = new DOMParser().parseFromString(html, "text/html")

  const workflow = text(page.querySelector('a[href*="/actions/workflows/"]'))
  const state = headerState(page)
  if (workflow === "" || state === null) return null

  const title = page.querySelector(".markdown-title")
  const number = text(title?.nextElementSibling).replace(/^#/, "")
  const branch = page.querySelector('a[href*="/tree/refs/heads/"], a[href*="/tree/refs/pull/"]')
  const pull = page.querySelector('a[href*="/pull/"]')
  const { trigger, startedAt } = triggerIn(page)

  return {
    workflow,
    title: text(title),
    number,
    state,
    seconds: secondsIn(beside(page, "Total duration")),
    trigger,
    actor: text(page.querySelector('a[href^="/apps/"], .col-triggered-content a[href^="/"]')),
    branch: text(branch),
    pullRequest: pull === null ? null : (/\/pull\/(\d+)/.exec(pull.getAttribute("href") ?? "")?.[1] ?? null),
    startedAt
  }
}

/**
 * Every job of the run, in the order they were started.
 *
 * The order given is theirs, and it is kept, because it is the order the jobs began in.
 * Sorting by duration or by name puts a gate job that failed because something else did
 * above the thing that broke, and a gate job's log never says what happened.
 */
export const jobsIn = (html: string): ReadonlyArray<Job> => {
  const page = new DOMParser().parseFromString(html, "text/html")

  return [...page.querySelectorAll("streaming-graph-job")].flatMap((one) => {
    const link = one.querySelector("a[href]")
    const url = link?.getAttribute("href") ?? ""
    const name = text(one.querySelector('[data-target="streaming-graph-job.name"]'))
    if (url === "" || name === "") return []

    const label = one.querySelector("svg[aria-label]")?.getAttribute("aria-label") ?? ""
    // Their duration is the last thing in the row, after the name and the icon.
    const said = [...one.querySelectorAll("div")].map(text).filter((words) => /^\d+[hms]/.test(words))

    return [{ name, state: stateOf(label), seconds: secondsIn(said[said.length - 1] ?? ""), url }]
  })
}

/**
 * One of their own forms, ready to be sent back to them.
 *
 * Re-running and cancelling are not `page_data` routes and have no JSON beside
 * them. They are classic Rails forms on the run page: a `_method=put`, an
 * `authenticity_token` minted for that page, and for one of the four re-run
 * forms an `only_failed_check_runs`. So the press is their form posted, which
 * means the fields are read off the page rather than composed here — see
 * `docs/spec/github-write-api.md` for the routes as they were measured.
 */
export type Press = {
  /** Their action, as written: a path on github.com and never a full address. */
  readonly action: string
  /** Every hidden field of the form, in the order it was written. */
  readonly fields: ReadonlyArray<readonly [string, string]>
}

/**
 * Which form answers which press.
 *
 * Cancel is addressed by the check suite and not by the run, which is the one
 * thing here a reader of the URLs would get wrong: run 31534838662 cancels at
 * `/suites/85543576165/cancel`. Nothing this code holds knows that number, and
 * it does not need to, because their form carries it.
 */
const RERUN = 'form[action$="/rerequest_check_suite"]'
const CANCEL = "form"
const CANCELS = /\/suites\/\d+\/cancel$/

/** Their hidden fields, which are the whole of what a press sends. */
const fieldsOf = (form: Element): ReadonlyArray<readonly [string, string]> =>
  [...form.querySelectorAll('input[type="hidden"][name]')].map(
    (input) =>
      [input.getAttribute("name") ?? "", input.getAttribute("value") ?? ""] as const
  )

/**
 * Whether a re-run form is the one that takes the failed jobs only.
 *
 * Their four re-run forms all post to one route and differ by this field alone:
 * two say `only_failed_check_runs` and two do not, the pair being the desktop
 * dialog and the mobile one. Anything else in the markup — the ids, the order —
 * is theirs to change.
 */
const failedOnly = (form: Element): boolean =>
  form.querySelector('input[type="hidden"][name="only_failed_check_runs"]') !== null

/**
 * The form for one press, or nothing where GitHub is not offering it.
 *
 * Nothing rather than an assembled request. A run whose workflow file has gone,
 * a run older than the window they keep re-runs for, and a reader without write
 * access all come back with a page carrying no form, and each is a refusal
 * GitHub has already made. Posting a guess at the route in those cases would
 * turn their clear no into an error report about ours.
 */
export const pressOn = (html: string, what: Pressing): Press | null => {
  const page = new DOMParser().parseFromString(html, "text/html")

  if (what === "cancel") {
    for (const form of page.querySelectorAll(CANCEL)) {
      const action = form.getAttribute("action") ?? ""
      if (CANCELS.test(action)) return { action, fields: fieldsOf(form) }
    }
    return null
  }

  const wants = what === "rerunFailed"
  for (const form of page.querySelectorAll(RERUN)) {
    if (failedOnly(form) !== wants) continue
    const action = form.getAttribute("action") ?? ""
    if (action !== "") return { action, fields: fieldsOf(form) }
  }
  return null
}

/** What may be pressed, which is what GitHub drew a form for. */
export const pressesOn = (html: string): Presses => ({
  mayRerun: pressOn(html, "rerun") !== null,
  mayRerunFailed: pressOn(html, "rerunFailed") !== null,
  mayCancel: pressOn(html, "cancel") !== null
})

/** Everything the run screen opens with, out of one fetch of their page. */
export const runOnPage = (html: string): RunOpening | null => {
  const run = runFrom(html)
  if (run === null) return null

  const notes = notesIn(html)
  /*
   * The forms are read for what they say may be done and their fields are left
   * behind. An `authenticity_token` is minted for one page and this opening is
   * kept in the store, so a press built out of a remembered token would be
   * refused for a reason nothing on the screen could explain. What is kept is
   * three booleans; the token is read again at the moment of the press.
   */
  return {
    run,
    /*
     * Here and not in `jobsIn`, because the rule needs two facts and only one of
     * them is beside a job. A job that failed inside a run GitHub concluded a
     * success was carried on past — `continue-on-error: true` — and their page
     * draws it in the same red as a failure that took the run down, which is
     * [#15452](https://github.com/orgs/community/discussions/15452). Both facts
     * are in this one fetch, so the tolerance costs nothing to know.
     */
    jobs: tolerating(run.state, jobsIn(html)),
    notes,
    gathering: gathered(notes),
    presses: pressesOn(html)
  }
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * Checked rather than trusted, for the reason a repository's front page checks: the store
 * outlives the code, and an entry written by a version of this extension that has since been
 * updated is exactly the shape that would otherwise reach the screen and fail there.
 */
export const isKeptRun = (value: unknown): value is RunOpening => {
  if (typeof value !== "object" || value === null) return false
  const kept: Partial<RunOpening> = value
  return (
    typeof kept.run === "object" &&
    kept.run !== null &&
    typeof kept.run.workflow === "string" &&
    typeof kept.run.number === "string" &&
    Array.isArray(kept.jobs) &&
    Array.isArray(kept.notes) &&
    Array.isArray(kept.gathering) &&
    // The newest of the fields, and the reason this check earns its keep: an
    // entry written before the presses existed would reach a screen that offers
    // controls and read `undefined` for whether to offer them.
    typeof kept.presses === "object" &&
    kept.presses !== null
  )
}
