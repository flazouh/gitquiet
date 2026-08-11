/**
 * The Actions list page, read for every Run on it.
 *
 * Scraping, and on purpose, for the same reason the run page is: their list is server-rendered
 * Turbo and one fetch carries all twenty-five rows with the ref, the outcome, the duration and
 * the pull request already on them. The JSON route beside it (`/actions/runs?...`) answers with
 * the same HTML.
 *
 * Written to come back empty rather than wrong. A row whose run link or ref cannot be read is
 * skipped rather than guessed at, so a page that has stopped looking like this yields nothing
 * and the screen can hand the document back to GitHub.
 *
 * Targets what a reader sees. The outcome, the run number and the workflow all come off one
 * `aria-label` that their row prints for a screen reader: "completed successfully:  Run 9857 of
 * ci. fix(events): bound the queue". That label is a sentence about the row, so it survives a
 * redesign in spirit, and it beats reading `.text-bold`, which on the same row is the commit
 * title as often as the workflow. Measured against `tests/fixtures/actionsList.html`.
 */

import type { Listed, Strand } from "../domain/strand"
import { refIn } from "../domain/strand"
import { secondsIn, stateOf, text } from "./outcome"

/** "Run 9857 of ci." out of the row's own label for a screen reader. */
const SAID = /Run\s+(\d+)\s+of\s+(.+?)\.\s/

const RUN = /\/actions\/runs\/(\d+)/

/**
 * What set the run off, out of the sentence their row prints about it.
 *
 * They write "Pull request #1761 synchronize by flazouh" for one and "by flazouh" alone for a
 * `pull_request_target` run, so the trigger is what is left when the pull request, the actor
 * and their "by" are taken out. Their own wording is kept rather than mapped to an event name:
 * a reader who saw "synchronize" on their page should read "synchronize" here.
 *
 * The actor comes off the end as a suffix and not as a pattern, because an actor is sometimes
 * `devin-ai-integration[bot]` and those brackets mean something else to a regular expression.
 */
const triggerIn = (holder: Element | null | undefined, actor: string): string => {
  const said = text(holder).replace(/\s+/g, " ").replace(/Pull request\s+#\d+/, "")
  const named = said.endsWith(actor) ? said.slice(0, said.length - actor.length) : said
  return named.replace(/\bby\s*$/, "").trim()
}

const rowIn = (row: Element): ReadonlyArray<Listed> => {
  const link = row.querySelector('a[href*="/actions/runs/"]')
  const url = link?.getAttribute("href") ?? ""
  const label = link?.getAttribute("aria-label") ?? ""
  const run = RUN.exec(url)?.[1] ?? ""

  const said = SAID.exec(label)
  if (run === "" || said === null) return []

  const who = row.querySelector('[data-hovercard-type="user"]')
  const actor = text(who)
  const pull = row.querySelector('[data-hovercard-type="pull_request"]')
  const pullRequest = pull === null ? null : text(pull).replace(/^#/, "")

  /*
   * Their ref, where the row names one. Five of the twenty-five rows on `oven-sh/bun/actions`
   * name none at all, and each of those is still a run of a pull request the row does name, so
   * a missing ref is a missing field and not a reason to drop the run.
   */
  const ref = row.querySelector("a.branch-name[title]")?.getAttribute("title") ?? ""
  if (ref === "" && pullRequest === null) return []

  /*
   * The outcome off their icon's own label, which says only the outcome.
   *
   * Not off the row's label, which is a sentence with the commit's title in it. On bun's list
   * a commit titled `fix(console): prepend "Assertion failed: " prefix` made every one of its
   * five runs read as a failure, because the word was in the title.
   */
  const icon = link?.querySelector("svg[aria-label]")?.getAttribute("aria-label") ?? ""

  return [
    {
      run,
      url,
      workflow: said[2] ?? "",
      number: said[1] ?? "",
      title: text(row.querySelector(".markdown-title")),
      state: stateOf(icon),
      seconds: secondsIn(text(row.querySelector(".issue-keyword"))),
      startedAt: row.querySelector("relative-time")?.getAttribute("datetime") ?? "",
      actor,
      // The sentence about the trigger is the span the actor's own link sits in.
      trigger: triggerIn(who?.parentElement, actor),
      ref: ref === "" ? null : refIn(ref),
      pullRequest
    }
  ]
}

/**
 * Every Run their list page carries, in the order they gave them.
 *
 * The order is theirs, which is newest first, and it is kept: grouping reads it to date each
 * Strand and a re-sort here would make that a second opinion.
 */
export const runsOnPage = (html: string): ReadonlyArray<Listed> => {
  const page = new DOMParser().parseFromString(html, "text/html")
  return [...page.querySelectorAll(".Box-row")].flatMap(rowIn)
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard a run keeps, and for the same reason: an entry written before an update is
 * the one shape that would reach the screen and fail there. One row is enough to tell — they
 * are written in one go by one version of this code.
 */
export const isKeptStrands = (value: unknown): value is ReadonlyArray<Strand> => {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true

  const one: Partial<Strand> = value[0]
  return (
    typeof one === "object" &&
    one !== null &&
    typeof one.head === "string" &&
    typeof one.state === "string" &&
    Array.isArray(one.latest) &&
    Array.isArray(one.runs)
  )
}
