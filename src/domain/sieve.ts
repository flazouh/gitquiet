import { Option } from "effect"
import type { PullRequestState } from "./PullRequest"
import { type ListedIssue, nameOf } from "./issues"
import type { InvolvedPullRequest, Opinion } from "./workingSet"

/**
 * What the reader has narrowed a list down to.
 *
 * Parsed out of one line of text rather than held as a dozen pieces of component
 * state, because the text is the thing the reader owns: it can be typed, edited
 * a word at a time, read back to see what is being asked, and copied to someone
 * else. The chips above the list write into the same line, so pointing and typing
 * are two ways of saying one sentence rather than two filters that can disagree.
 *
 * The vocabulary is GitHub's own — `author:`, `repo:`, `is:`, `review:`, `has:` — because
 * a reader on this page has been typing it into their search box for years, and
 * `src/domain/repoList.ts` already speaks it to their search API.
 *
 * Terms of one kind are an "either": `is:open is:merged` is both, since a reader
 * naming two states wants two states. Kinds are an "and": `author:me is:failing`
 * is the reader's own broken work, which is the question worth asking.
 */
export type Sieve = {
  /** Words with no term of their own, matched against title, author and address. */
  readonly words: ReadonlyArray<string>
  /** Logins, lowercased. `author:me` has already become a login here, or nothing. */
  readonly authors: ReadonlySet<string>
  /**
   * Repositories, lowercased, each as the reader named it.
   *
   * Either spelling is kept as typed rather than resolved to one of them, because
   * only a row can say which it answers: `repo:bun` is the repository called that
   * whoever owns it, and `repo:oven-sh/bun` is one repository. A reader looking
   * down a Working Set types the short one, and a chip writes the long one.
   */
  readonly repos: ReadonlySet<string>
  readonly states: ReadonlySet<PullRequestState>
  readonly checks: ReadonlySet<CheckState>
  readonly review: ReadonlySet<Opinion>
  readonly unread: boolean
  readonly commented: boolean
  /** Untouched for a week, which is the age at which a list stops being a list. */
  readonly stale: boolean
  /**
   * Whether a term asked about somebody in particular and there was nobody to
   * be. `author:me` signed out is a question with no answer, and matching every
   * row would answer the opposite of what was asked.
   */
  readonly impossible: boolean
}

type CheckState = "passing" | "failing" | "running"

const STATES: ReadonlyArray<PullRequestState> = ["open", "closed", "merged", "draft"]

const CHECKS: ReadonlyArray<CheckState> = ["passing", "failing", "running"]

/**
 * What `review:` is spelled as against what it means.
 *
 * `review:required` rather than `review:review-required`, since GitHub's own
 * search says the first and nobody has ever typed the second.
 */
const REVIEW: Record<string, Opinion> = {
  approved: "approved",
  "changes-requested": "changes-requested",
  required: "review-required"
}

const STALE = 7 * 24 * 60 * 60 * 1000

/** The words of a line, with the runs of whitespace between them thrown away. */
export const termsIn = (typed: string): ReadonlyArray<string> =>
  typed.split(/\s+/).filter((term) => term.length > 0)

/**
 * One line of text read as a question about a list.
 *
 * A term nobody recognises stays a word. Dropping it would widen the list the
 * moment a reader mistyped `authr:me`, showing them rows they had just excluded
 * and giving no sign of why; kept as a word it matches nothing, which is wrong in
 * the direction a reader can see and fix.
 */
export const sieveOf = (typed: string, viewer?: string): Sieve => {
  const words: Array<string> = []
  const authors = new Set<string>()
  const repos = new Set<string>()
  const states = new Set<PullRequestState>()
  const checks = new Set<CheckState>()
  const review = new Set<Opinion>()
  let unread = false
  let commented = false
  let stale = false
  let impossible = false

  for (const term of termsIn(typed)) {
    const at = term.indexOf(":")
    const name = at === -1 ? "" : term.slice(0, at).toLowerCase()
    const value = at === -1 ? "" : term.slice(at + 1).toLowerCase()

    if (name === "author" && value.length > 0) {
      if (value !== "me") authors.add(value)
      else if (viewer === undefined) impossible = true
      else authors.add(viewer.toLowerCase())
      continue
    }

    if (name === "repo" && value.length > 0) {
      repos.add(value)
      continue
    }

    if (name === "review" && REVIEW[value] !== undefined) {
      review.add(REVIEW[value])
      continue
    }

    if (name === "has" && value === "comments") {
      commented = true
      continue
    }

    if (name === "is") {
      if (value === "unread") {
        unread = true
        continue
      }
      if (value === "stale") {
        stale = true
        continue
      }
      const state = STATES.find((known) => known === value)
      if (state !== undefined) {
        states.add(state)
        continue
      }
      const check = CHECKS.find((known) => known === value)
      if (check !== undefined) {
        checks.add(check)
        continue
      }
    }

    words.push(term.toLowerCase())
  }

  return { words, authors, repos, states, checks, review, unread, commented, stale, impossible }
}

/** Nothing asked, which every row answers. */
export const EVERYTHING: Sieve = sieveOf("")

const addressOf = (one: InvolvedPullRequest): string =>
  `${one.reference.owner}/${one.reference.repo}#${one.reference.number}`

/**
 * Whether a row is in one of the repositories the reader named.
 *
 * Both spellings answered by the row rather than either normalised at the door:
 * a reader scanning a Working Set types `repo:bun`, and the chip above the rows
 * writes `repo:oven-sh/bun` because two owners can name a repository the same
 * way. Asked of the two kinds of row from one place, so a Court cannot hold a
 * pull request and an issue that disagree about what was asked.
 */
const inNamedRepo = (
  reference: { readonly owner: string; readonly repo: string },
  repos: ReadonlySet<string>
): boolean =>
  repos.has(reference.repo.toLowerCase()) ||
  repos.has(`${reference.owner}/${reference.repo}`.toLowerCase())

/**
 * Whether one pull request answers what the reader asked.
 *
 * `now` is a parameter because `is:stale` is the one term whose answer changes
 * without anything on the row changing, and a function that reads the clock
 * itself cannot be tested for the boundary it exists to draw.
 */
export const answers = (
  one: InvolvedPullRequest,
  sieve: Sieve,
  now: number = Date.now()
): boolean => {
  if (sieve.impossible) return false
  if (sieve.unread && one.readByViewer) return false
  if (sieve.commented && one.comments === 0) return false
  if (sieve.stale && now - Date.parse(one.changedAt) < STALE) return false

  if (sieve.authors.size > 0 && !sieve.authors.has(one.author.login.toLowerCase())) return false
  if (sieve.repos.size > 0 && !inNamedRepo(one.reference, sieve.repos)) return false
  if (sieve.states.size > 0 && !sieve.states.has(one.state)) return false

  // Absent is not passing. A row nobody has asked about yet turning up under
  // `is:passing` would be the filter guessing on the reader's behalf, and a green
  // answer is the one guess with consequences.
  if (sieve.checks.size > 0) {
    if (Option.isNone(one.checks)) return false
    if (!sieve.checks.has(one.checks.value.state)) return false
  }

  if (sieve.review.size > 0) {
    if (Option.isNone(one.reviewed)) return false
    if (!sieve.review.has(one.reviewed.value)) return false
  }

  if (sieve.words.length === 0) return true

  const haystack = `${one.title} ${one.author.login} ${addressOf(one)}`.toLowerCase()
  return sieve.words.every((word) => haystack.includes(word))
}

/**
 * Whether one Involved Issue answers what the reader asked.
 *
 * The terms an issue can answer, and no pretending about the rest. `is:passing`,
 * `review:approved` and `is:unread` are questions about a pull request — an issue
 * has no checks, nobody reviews one, and their search says nothing about whether
 * it has been read — so an issue drops out of a list narrowed by any of them,
 * which is what a reader asking about checks means. `is:stale` goes the same way
 * for a duller reason: their route sends no time of last change, and answering
 * from when it was raised would call a thread argued over this morning stale.
 *
 * `is:draft` and `is:merged` exclude an issue for the reason above; `is:open` and
 * `is:closed` are asked of it directly, since those are states it has. So is
 * `repo:`: an issue sits in a repository exactly as a pull request does, and a
 * reader narrowing a Court to one repository means the whole Court.
 */
export const answersIssue = (one: ListedIssue, sieve: Sieve): boolean => {
  if (sieve.impossible) return false
  if (sieve.unread || sieve.stale) return false
  if (sieve.checks.size > 0 || sieve.review.size > 0) return false
  if (sieve.commented && one.comments === 0) return false

  if (sieve.authors.size > 0 && !sieve.authors.has(one.author.login.toLowerCase())) return false
  if (sieve.repos.size > 0 && !inNamedRepo(one.reference, sieve.repos)) return false
  if (sieve.states.size > 0 && !sieve.states.has(one.state)) return false

  if (sieve.words.length === 0) return true

  const haystack = `${one.title} ${one.author.login} ${nameOf(one.reference)}`.toLowerCase()
  return sieve.words.every((word) => haystack.includes(word))
}

/**
 * Whether this row cannot be judged yet, rather than having been judged and lost.
 *
 * Checks and review decisions arrive in reads after the one that produces the
 * rows, so for a second or so a list filtered by either is a list of rows that all
 * fail — not because none of them pass, but because nothing has been asked. The
 * per-row rule above is right to exclude them: a red row shown under `is:passing`
 * is the one guess with consequences. What a screen must not do is call that
 * nothing-matched, which tells the reader their filter is wrong when it is the
 * page that is not finished.
 */
export const undecided = (one: InvolvedPullRequest, sieve: Sieve): boolean => {
  if (sieve.impossible) return false
  if (sieve.checks.size > 0 && Option.isNone(one.checks)) return true
  return sieve.review.size > 0 && Option.isNone(one.reviewed)
}

/**
 * Whether the box reads this term as a term, rather than as a word to find.
 *
 * Asked when an address arrives carrying GitHub's own search and the box is
 * about to be filled from it. GitHub's vocabulary is larger than this one —
 * `sort:`, `label:`, `milestone:`, `project:`, `linked:` — and every word this
 * box does not know becomes a word it looks for in the title. Seeding the box
 * with `sort:created-asc` would empty a list of three hundred rows and give the
 * reader nothing to read but their own filter.
 *
 * Dropping them is honest here, and only here. The search that fetched the page
 * was GitHub's and carried every one of those terms, so the rows on the screen
 * are already sorted, already labelled, already narrowed. What the box has to
 * say is which of that narrowing it can also undo.
 *
 * Asked by running the parser on the one term, rather than by a second list of
 * names beside the first. A term added to `sieveOf` and forgotten here would be
 * a term the box understands and refuses to be filled with.
 */
export const understood = (term: string): boolean => sieveOf(term).words.length === 0

/** Whether a term is already in the line, as a whole term rather than a prefix. */
export const asked = (typed: string, term: string): boolean =>
  termsIn(typed).some((one) => one.toLowerCase() === term.toLowerCase())

/**
 * The line with a term put in, or the same term taken out.
 *
 * What the reader typed is left exactly as it was, in the order they typed it: a
 * chip that reformats the box while they are still working in it takes the line
 * away from them.
 */
export const toggling = (typed: string, term: string): string => {
  const terms = termsIn(typed)
  const without = terms.filter((one) => one.toLowerCase() !== term.toLowerCase())

  return (without.length === terms.length ? [...terms, term] : without).join(" ")
}
