/**
 * Raising an issue: the address the form stands at, what the reader has typed,
 * and where it landed.
 *
 * The one write in this codebase that brings something into being rather than
 * changing something that already exists, which is why it has a type of its own
 * rather than a field on {@link IssueSnapshot}. A snapshot describes an issue
 * GitHub has; a Raising describes one nobody has yet, and the difference shows
 * in what each can answer: a Raising has no number, no author and no state,
 * because none of the three is decided until GitHub takes it.
 *
 * Here rather than beside the Courts in `issues.ts`. That file is about what is
 * owed on issues that exist, and a Court is a conclusion drawn from a read. This
 * is about the moment before there is anything to draw one from.
 */

import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"

/**
 * What the reader has typed, which is the whole of what GitHub needs.
 *
 * Two fields, against the eight their own form offers. Assignees, labels,
 * projects, milestone, issue type and a parent issue are each a second write on
 * a thing that does not exist yet, and every one of them is a control this
 * screen would draw before it could say what the issue is about. They are
 * deliberately left to the issue's own page, which already has the reader there
 * and already knows what it is looking at.
 */
export type Raising = {
  readonly title: string
  readonly body: string
}

/** A reader who has just arrived and typed nothing. */
export const NOTHING_YET: Raising = { title: "", body: "" }

/**
 * Whether there is enough to send.
 *
 * The title and nothing else, because that is what GitHub asks for: their own
 * form marks Title with a required mark and leaves the description unmarked.
 * Trimmed, so that a title of three spaces is the same as no title — it would
 * otherwise make a row in every list that nobody can read.
 */
export const enough = (draft: Raising): boolean => draft.title.trim() !== ""

/**
 * Where an issue landed, which is all the answer a screen needs.
 *
 * GitHub's answer carries the title back, and the node ids of the issue and its
 * repository, and none of the three is worth keeping: the reader typed the
 * title, and the next thing that happens is the issue's own page, which is
 * addressed by the number.
 */
export type Raised = {
  readonly owner: string
  readonly repo: string
  readonly number: number
}

/**
 * The form for raising one, and nothing else under `/issues`.
 *
 * Four segments ending in `new`, which refuses the three neighbours that have
 * the same shape: `/owner/repo/issues` is the repository's list,
 * `/owner/repo/issues/2137` is one issue, and `/owner/repo/issues/new/choose`
 * is GitHub's template picker. The picker is deliberately theirs — it is a menu
 * of files kept in the repository, and a reader who wants a template wants the
 * template, not a blank box this screen would hand them instead.
 */
const RAISING_PATH = /^\/([^/]+)\/([^/]+)\/issues\/new\/?$/

/**
 * The repository whose form this address is, or nothing where it is not one.
 *
 * Takes the whole address rather than the path for the two reasons
 * {@link issueListIn} does: the query carries what the box should open with, and
 * the host has to be refused. This runs on every page a content script is
 * matched into, and a page that merely ends in `/issues/new` on some other site
 * is not GitHub's form.
 */
export const raisingIn = (href: string): Option.Option<RepoRef> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(href)
  if (address === null || address.hostname !== "github.com") return Option.none()

  const match = RAISING_PATH.exec(address.pathname)
  if (match === null) return Option.none()

  const owner = match[1]
  const repo = match[2]
  if (owner === undefined || repo === undefined) return Option.none()

  return Option.some({ owner, repo })
}

/**
 * What the box opens with, read off the address.
 *
 * GitHub's own form honours `?title=` and `?body=`, and it is how every "report
 * this" link on the web arrives: a reader who pressed one has already had the
 * first sentence written for them, and a screen that opened empty would throw
 * it away. Nothing else in their query is honoured — `template` names a file in
 * the repository, and `labels` and `assignees` are controls this form does not
 * draw.
 */
export const seeding = (href: string): Raising => {
  const address = URL.parse(href)
  if (address === null) return NOTHING_YET

  return {
    title: address.searchParams.get("title") ?? "",
    body: address.searchParams.get("body") ?? ""
  }
}
