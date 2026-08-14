/**
 * Their issue search's answer, in this codebase's words.
 *
 * One of these reads per involvement, because that is how GitHub is willing to be
 * asked: there is no route that says "everything owed to me and why", only a
 * search that answers whatever query it is handed. Which query answered is the
 * fact carried through here, and it is the whole of what the Court is decided
 * from, the way a shelf is for a pull request.
 */

import { Effect, Option } from "effect"
import type { InvolvedIssue, Involvement, ListedIssue } from "../domain/issues"
import type { FoundIssues } from "../ports/GitHubGateway"
import { plainText } from "./plainText"
import { whereverItIs } from "./wherever"
import { IssueSearchAnswer } from "./wire"

export const decodeIssueSearch = whereverItIs(IssueSearchAnswer)

type Found = IssueSearchAnswer["results"][number]

/**
 * Whether this row is a pull request wearing an issue's clothes.
 *
 * GitHub models a pull request as an issue with a pull request hanging off it, so
 * their search can and does return both. The queries this gateway sends all say
 * `is:issue`, and this is the second lock on the same door: a pull request that
 * reached the Courts through here would be drawn twice, once as itself and once
 * as something that cannot be reviewed or merged.
 */
const isReallyAPullRequest = (row: Found): boolean =>
  row.issue?.issue.pull_request_id !== null && row.issue?.issue.pull_request_id !== undefined

/** One row as a listed issue, which is everything the row itself carries. */
const listedFrom = (row: Found): ListedIssue => ({
  reference: {
    owner: row.repo.repository.owner_login,
    repo: row.repo.repository.name,
    number: row.number
  },
  id: row.id,
  /*
   * `hl_title` is the title with the search's own matches marked up, so it is HTML
   * and its punctuation is escaped: a row read "Coadra&#39;s second vertical" on a
   * live list on 2026-08-14. Read through the same unescaping a commit headline
   * gets, which also drops any `<mark>` a query with free text in it would draw.
   */
  title: plainText(row.hl_title),
  author: {
    // A row without an author is one whose account is gone. GitHub renders those
    // as `ghost`, and so does everything else here that meets one.
    login: row.author_name ?? "ghost",
    // Their search says nothing about whether an account is an app, and the one
    // thing that would be drawn differently is a face this route already gives.
    isAutomated: false,
    faceUrl: Option.fromNullishOr(row.author_avatar_url)
  },
  state: row.state,
  comments: row.num_comments,
  /*
   * The words, where they are words.
   *
   * Read rather than counted, because the issue row now spends the four tracks a pull
   * request gives to review and diff on these instead — and "4 labels" in that space is
   * a number where a name would do. Filtered rather than decoded as strings at the wire,
   * which keeps the original worry answered: every row observed sent plain strings, and
   * a payload that starts sending objects costs that one label rather than the whole read.
   */
  labels: row.labels.filter((one): one is string => typeof one === "string"),
  raisedAt: row.created
})

/** Every row of one answer that is really an issue, in the order GitHub gave them. */
const listedIn = (answer: IssueSearchAnswer): ReadonlyArray<ListedIssue> =>
  answer.results.flatMap((row) => (isReallyAPullRequest(row) ? [] : [listedFrom(row)]))

/**
 * The same rows, each carrying the question that found it.
 *
 * The involvement is written on here rather than read off a row, because no row
 * carries one: it is the request that knew which question was being asked,
 * exactly as a shelf is.
 */
export const involvedIssuesIn = (
  involvement: Involvement,
  said: IssueSearchAnswer
): ReadonlyArray<InvolvedIssue> => listedIn(said).map((one) => ({ ...one, involvement }))

/** Decoded and mapped, for a caller holding raw JSON. */
export const involvedIssuesFrom = (
  involvement: Involvement,
  raw: unknown
): Effect.Effect<ReadonlyArray<InvolvedIssue>, unknown> =>
  decodeIssueSearch(raw).pipe(Effect.map((said) => involvedIssuesIn(involvement, said)))

/**
 * One page of a repository's issues: the rows, and where the page sits.
 *
 * No involvement, because this answer has none to give. The question was about
 * a repository and the rows come back saying nothing about the reader — see
 * `ListedIssue` for why that is two types rather than one optional field.
 *
 * The three numbers are GitHub's own and are the whole reason this is paged at
 * all: `flowline-labs/flowline` answers with 303 issues over 31 pages, and
 * without the count the first page of something large and the whole of
 * something small are the same picture.
 */
export const listedIssuesIn = (answer: IssueSearchAnswer): FoundIssues => {
  return {
    rows: listedIn(answer),
    /*
     * Left out rather than guessed where the payload does not add up. Their route
     * has always sent all three, and a page whose numbers disagree with itself is
     * better drawn as a list with no pager than as one whose Next goes nowhere.
     */
    pages:
      answer.page_count >= 1
        ? Option.some({
            current: answer.page,
            total: answer.page_count,
            count: answer.result_count
          })
        : Option.none()
  }
}

/** Decoded and mapped, for a caller holding raw JSON. */
export const listedIssuesFrom = (raw: unknown): Effect.Effect<FoundIssues, unknown> =>
  decodeIssueSearch(raw).pipe(Effect.map(listedIssuesIn))
