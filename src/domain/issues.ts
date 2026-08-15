/**
 * Involved Issues: the issues a Participant authored, was assigned, or was
 * mentioned in.
 *
 * Here because their absence is a complaint this interface would otherwise
 * reproduce word for word: "it took me 3 minutes to find my open issues when I
 * expected those to be displayed in the dashboard"
 * ([#131070](https://github.com/orgs/community/discussions/131070)). An issue is
 * owed to somebody exactly as a pull request is, so it takes a Court by the same
 * kind of rule, and a Court holding only the pull-request half of what is owed is
 * not a Court.
 *
 * Kept apart from `workingSet.ts` rather than added to it. An Involved Pull
 * Request carries checks, reviews, a head commit and a size, and an issue has
 * none of those and never will: folding the two into one type would mean six
 * fields that are permanently absent on half the rows, and a reader of the type
 * unable to tell "not read yet" from "cannot exist".
 */

import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"
import type { Participant } from "./PullRequest"
import type { Court } from "./workingSet"

/**
 * An issue's address, which is a repository and a number.
 *
 * Not {@link PullRequestRef}, though the three fields are the same three. That
 * one is what every pull request URL in this codebase is built from, and an
 * issue's page is at `/issues/` rather than `/pull/`: sharing the type would put
 * an issue one careless template literal away from linking to a pull request
 * that may not exist.
 */
export type IssueRef = {
  readonly owner: string
  readonly repo: string
  readonly number: number
}

/**
 * How the Participant comes to be involved, which is GitHub's answer rather than
 * ours.
 *
 * The counterpart of a Shelf. GitHub has no shelves for issues, but it does
 * answer three separate questions about them, and which question an issue came
 * back on is a fact rather than a conclusion: `assignee:@me` is the reader
 * having been given the thing, `author:@me` is the reader having asked for it,
 * `mentions:@me` is somebody wanting them to see it. The Court is what this
 * codebase concludes from that.
 */
export type Involvement = "assigned" | "authored" | "mentioned"

/**
 * All three, so that reading every Involved Issue is a loop rather than three
 * hand-written calls that can fall out of step with the type.
 */
export const INVOLVEMENTS: ReadonlyArray<Involvement> = ["assigned", "authored", "mentioned"]

/**
 * The two states an issue has.
 *
 * Two rather than the four a pull request has: nothing merges, and nothing is a
 * draft. GitHub's own `state_reason` says whether a closed issue was completed
 * or discarded, which is a distinction worth drawing on the issue's own page and
 * not in a list where both mean the same thing, that nobody owes it a move.
 */
export type IssueState = "open" | "closed"

/**
 * One issue as a row, as much of it as a row needs.
 *
 * Every field arrives from the one read, so unlike an Involved Pull Request
 * there is nothing here that is absent until a second request lands. What is
 * missing is missing for good: GitHub's issue search answers with no assignees
 * and no time of last change, so nothing here claims to know either.
 */
export type ListedIssue = {
  readonly reference: IssueRef
  /** GitHub's own id, which arrives as a string on this route rather than a number. */
  readonly id: string
  readonly title: string
  readonly author: Participant
  readonly state: IssueState
  readonly comments: number
  /** Counted rather than listed, for the reason a Working Set row counts its own. */
  /** The labels' own words, in the order GitHub gave them. Empty where it gave none. */
  readonly labels: ReadonlyArray<string>
  readonly raisedAt: string
}

/**
 * A listed issue that the reader has some part in, and which part.
 *
 * The involvement is the whole of the difference, and the whole of what a Court
 * is decided from. It exists on Home, where three questions were asked and each
 * of them named the reader. It does not exist on a repository's own list, which
 * asked one question that named a repository: three hundred issues come back
 * and the search says nothing about the reader's part in any of them. Two types
 * rather than an optional field, so a screen that has no involvement to give
 * cannot quietly pass `undefined` into a rule that reads it.
 */
export type InvolvedIssue = ListedIssue & {
  readonly involvement: Involvement
}

/**
 * Which involvement means the Participant is the one who has to move.
 *
 * A lookup rather than a chain of conditions, exactly as `COURT_OF_SHELF` is:
 * a fourth involvement added to the type without a Court decided for it is then
 * a compile error rather than an issue quietly landing in the wrong group.
 */
const COURT_OF_INVOLVEMENT: Record<Involvement, Court> = {
  // Somebody has given this to the reader, which is the plainest form the
  // question takes anywhere in this codebase.
  assigned: "needs-you",
  // The reader raised it and it is on somebody else to pick up. Raising an issue
  // is the act; whoever answers it owes the response, whether that is the person
  // already assigned to it or nobody yet.
  authored: "waiting",
  // Being named in a thread is being asked to read, and reading is not a move
  // this interface can watch anybody make.
  mentioned: "waiting"
}

/** What deciding an Involved Issue's Court needs, which is less than the issue. */
export type Weighing = {
  readonly involvement: Involvement
  readonly state: IssueState
}

/**
 * Which Court an Involved Issue sits in.
 *
 * The same shape as `courtOf` next door and for the same reason: the fact GitHub
 * answered decides it, with the state as the one correction applied on top,
 * because a read is a snapshot of a moment and an issue closed since is settled
 * whatever it came back as.
 *
 * Deliberately no correction for the assignees. An issue the reader authored and
 * somebody else is assigned is waiting on others here, and so is one nobody has
 * picked up, which looks like a distinction thrown away until it is asked what
 * either would change: neither is the reader's move, and the route this is read
 * from carries no assignees to tell them apart with. A rule that needed a fact
 * nobody can read would be a rule that guessed.
 */
export const courtOfIssue = ({ involvement, state }: Weighing): Court =>
  state === "closed" ? "settled" : COURT_OF_INVOLVEMENT[involvement]

/** Where a press on an Involved Issue goes, which is GitHub's own page for it. */
export const pageOf = (reference: IssueRef): string =>
  `/${reference.owner}/${reference.repo}/issues/${reference.number}`

/**
 * One issue's own page, and nothing else under `/issues`.
 *
 * The number is what does the work. `/owner/repo/issues` is the repository's
 * list and `/owner/repo/issues/new` is the form for raising one, and both have
 * the shape of this address without being it.
 */
const ISSUE_PATH = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/

/**
 * Reads an issue out of an address, or nothing where the address is not one.
 *
 * The inverse of {@link pageOf}, and tested as one: a press this codebase sends
 * somewhere the parser then refuses is a screen that never draws.
 */
export const fromPathname = (pathname: string): Option.Option<IssueRef> => {
  const match = ISSUE_PATH.exec(pathname)
  if (match === null) return Option.none()

  const owner = match[1]
  const repo = match[2]
  const number = match[3]
  if (owner === undefined || repo === undefined || number === undefined) {
    return Option.none()
  }

  return Option.some({ owner, repo, number: Number.parseInt(number, 10) })
}

/** `owner/repo#7`, which is how a person writes it and how a map is keyed by it. */
export const nameOf = (reference: IssueRef): string =>
  `${reference.owner}/${reference.repo}#${reference.number}`

/**
 * Which issue somebody means, in the shapes a person writes one.
 *
 * For the duplicate close, which is the one verb on an issue that needs a second issue named.
 * GitHub's own control answers this with a search field in a sub-menu, and the accessibility
 * thread on their close button — `community/community` #156844 — has the team who shipped it
 * wondering aloud whether that sub-menu confuses people. A reader closing a duplicate almost
 * always has the other issue open in a tab, so what they are holding is its address.
 *
 * Four shapes, all of them things people actually write: `#78`, `78`, `owner/repo#78`, and the
 * whole address with or without an anchor on the end. The repository is where the reader is,
 * for the two shapes that do not say, because a duplicate is nearly always in the same one.
 *
 * Nothing rather than a guess. "the login one" is not an issue, and a field that turned it
 * into issue 1 would close the reader's issue as a duplicate of something they never named.
 */
const SAID_HERE = /^#?(\d+)$/
const SAID_THERE = /^([^/\s]+)\/([^/#\s]+)#(\d+)$/

export const issueSaid = (said: string, here: RepoRef): Option.Option<IssueRef> => {
  const trimmed = said.trim()

  const address = URL.parse(trimmed)
  if (address !== null) return fromPathname(address.pathname)

  const there = SAID_THERE.exec(trimmed)
  if (there !== null) {
    const [, owner, repo, number] = there
    return owner === undefined || repo === undefined || number === undefined
      ? Option.none()
      : numbered({ owner, repo }, number)
  }

  const mine = SAID_HERE.exec(trimmed)
  return mine === null ? Option.none() : numbered(here, mine[1] ?? "")
}

/** An issue in a repository, where the number is one GitHub could have given out. */
const numbered = (repo: RepoRef, said: string): Option.Option<IssueRef> => {
  const number = Number.parseInt(said, 10)

  // Zero is the one number that parses and cannot be an issue, and it is what an empty
  // field and a stray hash both come to.
  return Number.isNaN(number) || number < 1 ? Option.none() : Option.some({ ...repo, number })
}
