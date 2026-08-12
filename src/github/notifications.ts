/**
 * The notifications page, read for every Notice on it.
 *
 * Scraping, and for a better reason than the Actions list has: this page is Rails-rendered
 * end to end. Measured on 2026-08-13 there is no `react-app`, no `turbo-frame` and no
 * `include-fragment` carrying the list — the document GitHub serves at `/notifications`
 * already holds all fifteen rows, with their write forms in them. One fetch is the whole
 * read, and every field a screen wants is on the row.
 *
 * Written to come back empty rather than wrong, as `runsOnPage` is. A row whose link cannot
 * be read is skipped rather than guessed at, so a page that has stopped looking like this
 * yields nothing and the screen can hand the document back to GitHub.
 *
 * Targets two things a redesign is unlikely to take with it. The reason, the read state and
 * whether the subject is a pull request come off `data-hydro-click`, which is the analytics
 * payload GitHub writes into the served HTML rather than something their bundle injects, and
 * it carries machine strings where the visible label carries English. The subject's state
 * comes off the Octicon their row draws, which is the same shape and the same colour token
 * their pull request pages use. Measured against `tests/fixtures/notifications.html`.
 */

import { Option } from "effect"
import type { Notice, Press, PressKind } from "../domain/notices"
import { standingOf } from "../domain/notices"
import type { Participant } from "../domain/PullRequest"
import { text } from "./outcome"

/** Their own thread number in the path, whichever page of the thread the row points at. */
const NUMBERED = /\/([^/]+\/[^/]+)\/(?:pull|issues|discussions)\/(\d+)/

const KINDS: ReadonlyArray<PressKind> = [
  "mark",
  "unmark",
  "archive",
  "unarchive",
  "subscribe",
  "unsubscribe",
  "star",
  "unstar"
]

const isKind = (word: string): word is PressKind => (KINDS as ReadonlyArray<string>).includes(word)

/**
 * What their analytics payload says about the row, or nothing where it is unreadable.
 *
 * Their own JSON, parsed rather than pattern-matched, because a row that has stopped
 * carrying it is a row this cannot read at all and pretending otherwise would put every
 * Notice under one reason.
 */
const hydroIn = (link: Element | null): Record<string, unknown> => {
  const raw = link?.getAttribute("data-hydro-click")
  if (raw === undefined || raw === null) return {}

  const read = Option.liftThrowable((json: string) => JSON.parse(json) as unknown)(raw)
  if (Option.isNone(read)) return {}

  const payload = (read.value as { payload?: { metadata?: unknown } }).payload?.metadata
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {}
}

/**
 * Who has been in the thread lately, machines marked by the shape of their link.
 *
 * An App's page is `/apps/<name>` and a person's is `/<login>`, which is the one thing on
 * this row that says which is which without inference. It is not authorship, and this is
 * careful not to imply it is: on a pull request the reader opened themselves, GitHub drew
 * the App first.
 */
const participantsIn = (row: Element): ReadonlyArray<Participant> =>
  [...row.querySelectorAll("a.avatar")].flatMap((face): ReadonlyArray<Participant> => {
    const href = face.getAttribute("href") ?? ""
    if (href === "") return []

    const app = href.startsWith("/apps/")
    const login = href.replace(/^\/apps\//, "").replace(/^\//, "")
    if (login === "") return []

    return [
      {
        login,
        isAutomated: app,
        faceUrl: Option.fromNullishOr(face.querySelector("img")?.getAttribute("src"))
      }
    ]
  })

/**
 * Their forms under one holder, one per kind, with the token off each.
 *
 * First of each kind wins, because GitHub draws every list of actions twice: once for a wide
 * window and once for a narrow one. Which copy is kept does not matter — the two carry
 * different tokens and their server takes either, which is what pressing the same button in a
 * narrow window has always done.
 */
const formsIn = (holder: ParentNode): ReadonlyArray<Omit<Press, "ids">> => {
  const held = new Map<PressKind, Omit<Press, "ids">>()

  for (const form of holder.querySelectorAll('form[action^="/notifications/beta/"]')) {
    const route = form.getAttribute("action") ?? ""
    const kind = route.slice("/notifications/beta/".length)
    if (!isKind(kind) || held.has(kind)) continue

    const token = form.querySelector('input[name="authenticity_token"]')?.getAttribute("value") ?? ""
    if (token === "") continue

    held.set(kind, { kind, route, token })
  }

  return [...held.values()]
}

const rowIn = (bulk: ReadonlyArray<Omit<Press, "ids">>) => (row: Element): ReadonlyArray<Notice> => {
  const id = row.getAttribute("data-notification-id") ?? ""
  const link = row.querySelector("a.notification-list-item-link")
  const url = link?.getAttribute("href") ?? ""
  if (id === "" || url === "") return []

  const said = hydroIn(link)

  /*
   * The repository and the number out of the path together, which is the only reading that
   * survives their push rows. A notification about a push links a range of commits inside
   * the pull request — `/owner/repo/pull/1948/changes/<sha>..<sha>` — so the last segment is
   * a pair of shas and the last number in the path is part of one.
   */
  const named = NUMBERED.exec(url)

  /*
   * Their advisory rows name no repository of the reader's at all: the link is
   * `/advisories/GHSA-…` and the heading is the advisory. Kept, with the heading standing in
   * for the repository, because a vulnerability in something the reader depends on is the
   * last row that should be dropped for being shaped oddly.
   */
  const heading = text(row.querySelector("p.f6")).replace(/\s+/g, " ").trim()

  return [
    {
      id,
      url,
      repository: named?.[1] ?? heading,
      number: named?.[2] ?? null,
      title: text(row.querySelector("p.markdown-title")),
      reason: typeof said["reason"] === "string" ? said["reason"] : "",
      // Their icon's own classes, which carry the shape and the state colour together.
      standing: standingOf(row.querySelector("a.notification-list-item-link svg.octicon")?.getAttribute("class") ?? ""),
      /*
       * Their class on the row and not the analytics payload's `is_unread`. The two agree on
       * a freshly served page and only one of them is what their own script rewrites when the
       * reader marks a row read without leaving.
       */
      unread: row.classList.contains("notification-unread"),
      subscribed: !row.classList.contains("notification-unsubscribed"),
      movedAt: row.querySelector("relative-time")?.getAttribute("datetime") ?? "",
      participants: participantsIn(row),
      /*
       * Every press addressed by this row's own id, whether GitHub's form carried it or not.
       *
       * The six in the row carry it as a hidden field already. Marking read and unread do not
       * exist in the row at all — they are forms at the top of the page which take their ids
       * from the checkbox beside each row — so those two are the page's token with this id
       * put on it. Exercised on 2026-08-13: `/notifications/beta/unmark` with one
       * `notification_ids[]` answered 200 and put that row back in `?query=is:unread`, and
       * `mark` took it out again.
       */
      presses: [...formsIn(row), ...bulk].map((one) => ({ ...one, ids: [id] }))
    }
  ]
}

/** Marking read and unread, which are the two presses their markup keeps off the row. */
const bulkIn = (page: Document): ReadonlyArray<Omit<Press, "ids">> =>
  formsIn(page).filter((one) => one.kind === "mark" || one.kind === "unmark")

/**
 * Every Notice their inbox carries, in the order they gave them.
 *
 * The order is theirs, and it is kept for the reason the Actions list keeps theirs: grouping
 * re-orders within a Court and a re-sort here would be a second opinion about which of two
 * rows moved last.
 *
 * Their rows are flat whether or not GitHub is grouping them. A plain inbox reports
 * `is_grouped_by: "repository"` and a queried one reports `"date"`, and both draw the same
 * list of `li` elements, so this does not have to know which mode the reader left the page in.
 */
export const noticesOnPage = (html: string): ReadonlyArray<Notice> => {
  const page = new DOMParser().parseFromString(html, "text/html")
  return [...page.querySelectorAll("li[data-notification-id]")].flatMap(rowIn(bulkIn(page)))
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard the Actions list keeps, for the same reason: an entry written before an
 * update is the one shape that would reach the screen and fail there. One row is enough to
 * tell — they are written in one go by one version of this code.
 */
export const isKeptNotices = (value: unknown): value is ReadonlyArray<Notice> => {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true

  const one: Partial<Notice> = value[0]
  return (
    typeof one === "object" &&
    one !== null &&
    typeof one.id === "string" &&
    typeof one.reason === "string" &&
    typeof one.standing === "string" &&
    Array.isArray(one.participants) &&
    Array.isArray(one.presses)
  )
}
