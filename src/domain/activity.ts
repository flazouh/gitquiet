/**
 * What happened elsewhere, in the order it happened.
 *
 * The third Destination, and the one with the longest paper trail behind it: "I'd like an
 * option for the Feed to be my default view" (146 upvotes), "Bring back the old feed
 * please, the new 'For You' tab is horrible", and
 * [#173638](https://github.com/orgs/community/discussions/173638) — "The updated
 * dashboard-feed looses important functionality (no more commits)".
 *
 * That last one is not a matter of opinion, and it was checked rather than taken on trust.
 * GitHub's own feed route answers with four kinds of card — a follow, a merged pull
 * request, a trending repository and a recommendation — and no pushes at all, while the
 * chronological events for the same account in the same minute were two thirds pushes. So
 * Activity is built from the events rather than from their feed, and it is never ranked:
 * ranking is the thing being undone.
 *
 * Nothing here is owed to anybody, which is what keeps it out of the Courts.
 */

import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"

/** Who did it, as little as is needed to say so. */
export type Doer = {
  readonly login: string
  readonly faceUrl: Option.Option<string>
}

/**
 * One thing that happened, named by what a reader would call it.
 *
 * A push carries its branch, because a push is the functionality #173638 is about, and
 * nothing more: their public events answer with `ref` alone — no commit count and no
 * subjects, both of which were checked rather than assumed. So a line reads "pushed to
 * main", which is less than the old feed said and infinitely more than the new one, where
 * pushes do not appear at all. `howMany` is kept for a source that does say, and is left
 * absent rather than guessed by the one in use.
 */
export type Happening = {
  readonly kind:
    | "pushed"
    | "opened"
    | "merged"
    | "closed"
    | "reopened"
    | "commented"
    | "raised"
    | "settled"
    | "starred"
    | "branched"
    | "deleted"
  readonly at: string
  readonly by: ReadonlyArray<Doer>
  readonly repo: RepoRef
  /** A branch for a push or a branching, nothing for the rest. */
  readonly ref: Option.Option<string>
  /** How many commits a push carried, where GitHub said. */
  readonly howMany: Option.Option<number>
  /**
   * How many times the same act repeated, for the runs a working afternoon produces.
   *
   * Six pushes to one branch in nine minutes is one thing somebody did, and drawing it as
   * six lines is how their own feed used to read. One unless a run was folded together.
   */
  readonly howOften: number
  /** The pull request or issue this is about, where it is about one. */
  readonly number: Option.Option<number>
  readonly title: Option.Option<string>
  /** Where a press goes, which is always somewhere on GitHub rather than in here. */
  readonly url: string
}

/** Everything that happened in one repository, newest first. */
export type RepositoryActivity = {
  readonly repo: RepoRef
  /** When the newest of them happened, which is what orders the groups. */
  readonly at: string
  readonly happenings: ReadonlyArray<Happening>
}

const nameOf = (repo: RepoRef): string => `${repo.owner}/${repo.repo}`

const newestFirst = (left: string, right: string): number => right.localeCompare(left)

/**
 * Stars, and anything else a crowd does at once, said once.
 *
 * "Fourteen stars in a row cost one line rather than fourteen" is the whole rule. Only
 * within a repository and only for the same kind of act, so a push and a star never merge,
 * and the people are kept rather than counted — a reader who knows one of them learns more
 * from a name than from a number.
 */
const sameOne = (left: Happening, right: Happening): boolean =>
  left.by.length === 1 &&
  right.by.length === 1 &&
  left.by[0]?.login === right.by[0]?.login

const sameBranch = (left: Happening, right: Happening): boolean =>
  Option.getOrElse(left.ref, () => "") === Option.getOrElse(right.ref, () => "")

const gathered = (happenings: ReadonlyArray<Happening>): ReadonlyArray<Happening> => {
  const kept: Array<Happening> = []

  for (const one of happenings) {
    const last = kept[kept.length - 1]
    if (last === undefined || last.kind !== one.kind) {
      kept.push(one)
      continue
    }

    // A crowd doing the thing that says nothing but who did it. The people are kept rather
    // than counted: a reader who knows one of them learns more from a name than a number.
    if (one.kind === "starred") {
      kept[kept.length - 1] = {
        ...last,
        howOften: last.howOften + one.howOften,
        by: [...last.by, ...one.by.filter((who) => !last.by.some((had) => had.login === who.login))]
      }
      continue
    }

    // One person pushing to one branch several times over an afternoon. Drawn as six lines
    // this is the feed GitHub used to have and nobody could read; drawn as one it is the
    // sentence somebody would actually say. Only a run of them, so a push to another branch
    // in between stays a push to another branch.
    if (one.kind === "pushed" && sameOne(last, one) && sameBranch(last, one)) {
      kept[kept.length - 1] = { ...last, howOften: last.howOften + one.howOften }
      continue
    }

    kept.push(one)
  }

  return kept
}

/**
 * The happenings arranged for reading: one section per repository, newest first.
 *
 * Grouped because the alternative is what GitHub shows — fourteen consecutive lines about
 * one repository, each of which has to be read to find out it is the same repository — and
 * ordered by when each repository last stirred rather than by how much happened in it.
 */
export const activityIn = (
  happenings: ReadonlyArray<Happening>
): ReadonlyArray<RepositoryActivity> => {
  const found = new Map<string, Array<Happening>>()

  for (const one of happenings) {
    const key = nameOf(one.repo)
    const already = found.get(key)
    if (already === undefined) found.set(key, [one])
    else already.push(one)
  }

  return [...found.values()]
    .flatMap((inOne): ReadonlyArray<RepositoryActivity> => {
      const sorted = [...inOne].sort((left, right) => newestFirst(left.at, right.at))
      const newest = sorted[0]
      if (newest === undefined) return []

      return [{ repo: newest.repo, at: newest.at, happenings: gathered(sorted) }]
    })
    .sort((left, right) => newestFirst(left.at, right.at))
}

/**
 * How much happened in total, for the Destination's own count.
 *
 * Counted before the folding rather than after it: the number beside Activity answers "how
 * much have I missed", and six pushes drawn as one line are still six pushes missed.
 */
export const howMuchHappened = (activity: ReadonlyArray<RepositoryActivity>): number =>
  activity.reduce(
    (running, one) =>
      running + one.happenings.reduce((many, what) => many + what.howOften, 0),
    0
  )
