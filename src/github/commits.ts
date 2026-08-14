/**
 * A branch's commits, in this codebase's words.
 *
 * The same route their own page reads, asked for as data. Their commit list is
 * a React page whose payload arrives whole when the request says it wants JSON,
 * which is the request this gateway already makes everywhere else.
 */

import { Effect, Option, Schema } from "effect"
import type { Day, History, Landed, Mark, Marks } from "../domain/commitList"
import { proposalIn } from "../domain/commitList"
import type { Participant } from "../domain/PullRequest"
import type { CheckRollup } from "../domain/workingSet"
import { plainText } from "./plainText"
import type { CommitsAnswer } from "./wire"
import { commitsIn, CommitsRoute, DeferredCommitsRoute } from "./wire"

export const decodeCommits = Schema.decodeUnknownEffect(CommitsRoute)
export const decodeDeferred = Schema.decodeUnknownEffect(DeferredCommitsRoute)

type WireCommit = CommitsAnswer["commitGroups"][number]["commits"][number]

/** What GitHub renders where an account is gone, and so does everything here. */
const GHOST = "ghost"

/**
 * The suffix GitHub puts on an app's login, and the only mark of one on this
 * payload — it carries no `isAgent`, the way the pull request routes do.
 */
const APP = /\[bot\]$/

/**
 * One of the people a commit is attributed to.
 *
 * A commit written at an address that belongs to no account has a display name
 * and no login. The name is still the best thing to call them, so it is taken
 * before falling back to the ghost.
 */
const personFrom = (author: WireCommit["authors"][number]): Participant => {
  const login = author.login ?? author.displayName ?? GHOST

  return {
    login,
    isAutomated: APP.test(login),
    faceUrl: Option.fromNullishOr(author.avatarUrl)
  }
}

/**
 * Who committed it, where GitHub says that is somebody else.
 *
 * Their own `committerAttribution` decides, rather than comparing the two
 * logins here: the ordinary commit has `web-flow` as its committer — GitHub's
 * machine, on every squashed merge in every repository — and a row naming that
 * as a person is a row full of noise. They already answer the question.
 */
const committerFrom = (commit: WireCommit): Option.Option<Participant> => {
  if (commit.committerAttribution !== true) return Option.none()

  const committer = commit.committer
  return committer === undefined || committer === null
    ? Option.none()
    : Option.some(personFrom(committer))
}

const landedFrom = (commit: WireCommit): Landed => {
  const headline = commit.shortMessage ?? plainText(commit.shortMessageMarkdown ?? "")

  return {
    sha: commit.oid,
    // Seven, which is what their own links abbreviate to.
    abbreviatedSha: commit.oid.slice(0, 7),
    headline,
    bodyHtml: Option.fromNullishOr(commit.bodyMessageHtml),
    authors: commit.authors.map(personFrom),
    committer: committerFrom(commit),
    pullRequest: proposalIn(headline),
    createdAt: commit.authoredDate,
    // Nothing yet. The read that answers this is the second one, and the list is
    // drawn before it is asked.
    mark: Option.none(),
    stat: Option.none()
  }
}

/**
 * Their deferred address, from the repository onwards.
 *
 * They write it whole — `/owner/repo/commits/deferred_commit_data/main?…` — and
 * every route this gateway reads is written from the repository onwards, because
 * the gateway is what puts the repository on the front. Left as it came, it was
 * asked for twice over and answered with their 404 page.
 *
 * The two segments are dropped by position rather than by name, since the payload
 * that carries the address is not obliged to also carry the repository.
 */
const restIn = (said: string): string => said.replace(/^\/[^/]+\/[^/]+/, "")

/**
 * One page of a branch's history, out of their payload for it.
 *
 * A cursor is only carried where GitHub said there is a page at the end of it.
 * They send both cursors on every answer, including the first, where the one
 * pointing backwards points at the page being read — and a Newer button on the
 * newest page is a button that goes nowhere.
 */
export const historyIn = (said: CommitsRoute): History => {
  const answer = commitsIn(said)
  const { pagination } = answer.filters

  const days: ReadonlyArray<Day> = answer.commitGroups.map((group) => ({
    title: group.title,
    commits: group.commits.map(landedFrom)
  }))

  return {
    branch: answer.refInfo.name,
    days,
    older: pagination.hasNextPage ? Option.fromNullishOr(pagination.endCursor) : Option.none(),
    newer: pagination.hasPreviousPage ? Option.fromNullishOr(pagination.startCursor) : Option.none(),
    rest: Option.fromNullishOr(answer.metadata?.deferredDataUrl).pipe(Option.map(restIn))
  }
}

/** Decoded and mapped, for a caller holding raw JSON. */
export const historyFrom = (raw: unknown): Effect.Effect<History, unknown> =>
  decodeCommits(raw).pipe(Effect.map(historyIn))

/**
 * Their word for how a run of checks came out, in the three this interface draws.
 *
 * `error` is a run that broke rather than one that failed, and `expected` is a
 * check that has been promised and not reported. Both are folded into the states
 * beside them for the same reason the Working Set folds them: a row has one mark
 * for this, and "broke" and "failed" ask the reader to do the same thing.
 */
const stateOf = (said: string): Option.Option<CheckRollup["state"]> => {
  if (said === "success") return Option.some("passing")
  if (said === "failure" || said === "error") return Option.some("failing")
  if (said === "pending" || said === "expected") return Option.some("running")

  return Option.none()
}

type WireDeferred = DeferredCommitsRoute["deferredCommits"][number]

const markFrom = (said: WireDeferred): Mark => {
  const checks = said.statusCheckStatus

  return {
    checks:
      checks === undefined || checks === null
        ? Option.none()
        : stateOf(checks.state).pipe(
            Option.map((state) => ({ state, said: checks.short_text ?? "" }))
          ),
    verified: said.verifiedStatus === "verified",
    comments: said.commentCount ?? 0
  }
}

/**
 * The deferred answers, by the commit each is about.
 *
 * A map rather than a list, because the only thing anybody does with these is
 * look one up by sha: they come back in whatever order GitHub answered, for a
 * page that has since been grouped into days.
 */
export const marksIn = (said: DeferredCommitsRoute): Marks =>
  new Map(said.deferredCommits.map((one) => [one.oid, markFrom(one)]))

/** Decoded and mapped, for a caller holding raw JSON. */
export const marksFrom = (raw: unknown): Effect.Effect<Marks, unknown> =>
  decodeDeferred(raw).pipe(Effect.map(marksIn))
