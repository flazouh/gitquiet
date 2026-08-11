import { Effect, Option } from "effect"
import { GitHubGateway, type FoundIssues } from "../ports/GitHubGateway"

/**
 * One page of an issue list, ready for a screen.
 *
 * The gateway's own answer, passed straight through. This layer exists on a
 * repository's pull request list to arrange four reads into Courts; here there
 * is one read and no arranging, so a shape of its own would only be a second
 * name for the same thing.
 */
export type ListedIssues = FoundIssues

/*
 * A query and a page rather than the page object either screen holds.
 *
 * Two screens read through here — a repository's issues and the reader's own
 * across everything — and they differ in exactly one thing, which is the search
 * they build. Each builds its own in `domain`, where the rules about which
 * qualifiers are the page's and which are the reader's live, and hands the
 * finished line down. A layer that took both page types would be a switch over
 * a difference that has already been settled.
 */

/**
 * Reads the page that survives to the next one.
 *
 * The pointer's version of {@link loadIssueList}, and the whole of it: the
 * search is the page, nothing else is read, so warming is one request rather
 * than the seven a repository's pull request list needs.
 */
export const warmIssueList = Effect.fn("warmIssueList")(function* (query: string, page: number) {
  const gateway = yield* GitHubGateway
  yield* Effect.asVoid(gateway.issueSearch(query, page))
})

/**
 * One page of an issue list as it was last read, without asking GitHub.
 *
 * Nothing without the page itself. There is no second read to go on missing
 * here — no shelves saying which rows are the reader's, no standings, no
 * stacks — so a page either was kept whole or was not kept.
 */
export const rememberedIssueList = Effect.fn("rememberedIssueList")(function* (
  query: string,
  page: number
) {
  const gateway = yield* GitHubGateway
  return yield* gateway.rememberedIssueSearch(query, page)
})

/**
 * One page of an issue list.
 *
 * One read, which fails loudly. It is the page: without it there is nothing to
 * show, and a list that quietly showed nothing would read as a repository with
 * no open issues, which is a different and wrong answer.
 *
 * No second stage and so no `partly`, unlike every other list here. A
 * repository's pull request page reports four times because its reads land
 * minutes apart; this one has nothing to report between the request and the
 * answer.
 */
export const loadIssueList = Effect.fn("loadIssueList")(function* (query: string, page: number) {
  const gateway = yield* GitHubGateway
  return yield* gateway.issueSearch(query, page)
})

/**
 * Whether a page of issues is worth drawing at all.
 *
 * A page beyond the last one is GitHub's own answer to a hand-edited address,
 * and it comes back as an empty list rather than a refusal. Told apart here so
 * the screen can say so, rather than showing "no issues" for a repository that
 * has three hundred.
 */
export const isPastTheEnd = (listed: ListedIssues): boolean =>
  listed.rows.length === 0 &&
  Option.isSome(listed.pages) &&
  listed.pages.value.current > listed.pages.value.total
