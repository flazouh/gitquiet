/**
 * GitHub's events, in this codebase's words.
 *
 * Seven of their two dozen event types are drawn, chosen by what a reader would want to
 * know happened: somebody pushed, opened, merged, closed or commented, raised or settled an
 * issue, starred, made a branch or deleted one. Anything else is left out rather than shown
 * as itself — a `MemberEvent` on the Activity Destination would be noise of the kind this
 * page exists to remove.
 */

import { Effect, Option } from "effect"
import type { Doer, Happening } from "../domain/activity"
import { PublicEvents } from "./wire"
import { whereverItIs } from "./wherever"

export const decodeEvents = whereverItIs(PublicEvents)

type Event = PublicEvents[number]

/** `refs/heads/main` as `main`, which is what a reader calls it. */
const branchIn = (ref: string | null | undefined): Option.Option<string> =>
  ref === null || ref === undefined
    ? Option.none()
    : Option.some(ref.replace(/^refs\/(heads|tags)\//, ""))

const doerIn = (event: Event): ReadonlyArray<Doer> => [
  {
    login: event.actor.login,
    faceUrl: Option.fromNullishOr(event.actor.avatar_url)
  }
]

/**
 * What one event was, or nothing for the ones this page does not draw.
 *
 * A pull request event needs its `action` and its `merged` read together: GitHub spells a
 * merge as a close of a merged pull request, and calling that a close would tell a reader
 * the opposite of what happened.
 */
const happeningIn = (event: Event): Option.Option<Happening> => {
  const [owner, repo] = event.repo.name.split("/")
  if (owner === undefined || repo === undefined) return Option.none()

  const common = {
    at: event.created_at,
    howOften: 1,
    by: doerIn(event),
    repo: { owner, repo },
    ref: Option.none<string>(),
    howMany: Option.none<number>(),
    number: Option.none<number>(),
    title: Option.none<string>()
  }

  const inRepository = `https://github.com/${event.repo.name}`

  switch (event.type) {
    case "PushEvent":
      return Option.some({
        ...common,
        kind: "pushed",
        ref: branchIn(event.payload.ref),
        howMany: Option.fromNullishOr(event.payload.size),
        url: Option.match(branchIn(event.payload.ref), {
          onNone: () => inRepository,
          onSome: (branch) => `${inRepository}/commits/${branch}`
        })
      })

    case "PullRequestEvent": {
      const pull = event.payload.pull_request
      if (pull === null || pull === undefined) return Option.none()

      // Their `action` says merged itself — a live account's events had four closes, two
      // merges and one reopen — so a merge never has to be inferred from a close.
      const kind =
        event.payload.action === "merged"
          ? "merged"
          : event.payload.action === "closed"
            ? "closed"
            : event.payload.action === "reopened"
              ? "reopened"
              : "opened"

      return Option.some({
        ...common,
        kind,
        number: Option.some(pull.number),
        // No title anywhere in their payload, so the branch stands in for one: "opened #4
        // from widen-the-rail" says more than "opened #4" and neither is invented.
        ref: branchIn(pull.head?.ref),
        url: `${inRepository}/pull/${pull.number}`
      })
    }

    case "IssuesEvent": {
      const issue = event.payload.issue
      if (issue === null || issue === undefined) return Option.none()

      return Option.some({
        ...common,
        kind: event.payload.action === "closed" ? "settled" : "raised",
        number: Option.some(issue.number),
        title: Option.some(issue.title),
        url: issue.html_url
      })
    }

    /*
     * A review, which is the act somebody's profile is read for. Their payload carries the
     * review's own address and the pull request's number, and no title — the same silence
     * as every other pull request event here.
     */
    case "PullRequestReviewEvent": {
      const pull = event.payload.pull_request
      if (pull === null || pull === undefined) return Option.none()

      const at = `${inRepository}/pull/${pull.number}`
      return Option.some({
        ...common,
        kind: "reviewed",
        number: Option.some(pull.number),
        url: event.payload.review?.html_url ?? at
      })
    }

    case "IssueCommentEvent": {
      const issue = event.payload.issue
      if (issue === null || issue === undefined) return Option.none()

      return Option.some({
        ...common,
        kind: "commented",
        number: Option.some(issue.number),
        title: Option.some(issue.title),
        url: event.payload.comment?.html_url ?? issue.html_url
      })
    }

    case "WatchEvent":
      return Option.some({ ...common, kind: "starred", url: inRepository })

    case "CreateEvent":
      // Their `CreateEvent` covers a repository, a branch and a tag. Only a branch is
      // worth a line: a new repository is a thing to be told about once, on their own
      // page, and a tag is release plumbing.
      return event.payload.ref_type === "branch"
        ? Option.some({
            ...common,
            kind: "branched",
            ref: branchIn(event.payload.ref),
            url: Option.match(branchIn(event.payload.ref), {
              onNone: () => inRepository,
              onSome: (branch) => `${inRepository}/tree/${branch}`
            })
          })
        : Option.none()

    case "DeleteEvent":
      return event.payload.ref_type === "branch"
        ? Option.some({
            ...common,
            kind: "deleted",
            ref: branchIn(event.payload.ref),
            url: `${inRepository}/branches`
          })
        : Option.none()

    default:
      return Option.none()
  }
}

/** Their events as happenings, the unfamiliar ones left out. */
export const happeningsIn = (events: PublicEvents): ReadonlyArray<Happening> =>
  events.flatMap((event) =>
    Option.match(happeningIn(event), {
      onNone: (): ReadonlyArray<Happening> => [],
      onSome: (one) => [one]
    })
  )

/** Decoded and mapped, for a caller holding raw JSON. */
export const happeningsFrom = (
  raw: unknown
): Effect.Effect<ReadonlyArray<Happening>, unknown> =>
  decodeEvents(raw).pipe(Effect.map(happeningsIn))
