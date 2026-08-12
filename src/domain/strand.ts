import { Option } from "effect"
import type { CheckState } from "./PullRequest"
import type { RepoRef } from "./PullRequestRef"
import { worstOf } from "./run"

/**
 * Which ref a Run was against.
 *
 * Their list names one on every row, in two spellings. A push or a pull request's own runs
 * name a head branch; a `pull_request_target` workflow names `refs/pull/<n>/head`.
 */
export type Ref =
  | { readonly kind: "branch"; readonly name: string }
  | { readonly kind: "pull"; readonly number: string }

/**
 * One Workflow, as the list down the side of their own page names it.
 *
 * Two fields because their page keeps the Workflow's two names apart and a reader only ever
 * sees one of them: a Run row is labelled with the `name:` inside the file, and the file
 * itself is named nowhere on the row.
 */
export type Workflow = {
  /** Its own `name:`, or its filename where it has none. The word their rows print. */
  readonly name: string
  /**
   * The file, as their own link to it writes it: `ci.yml`, under `.github/workflows`.
   *
   * Sometimes not a file at all. GitHub runs four or five Workflows of its own that nobody
   * committed — code scanning, Dependabot, the Copilot reviewer — and writes those as a slug
   * with a folder on the front, `github-code-scanning/codeql`. Read as their own spelling for
   * the Workflow either way, because that is what it is used for: naming one Workflow apart
   * from the rest of them for as long as a reader's decision about it has to last.
   */
  readonly file: string
}

/** One Run, in the facts their list page gives about it. */
export type Listed = {
  readonly run: string
  readonly url: string
  readonly workflow: string
  /**
   * The file the Workflow is, where the list down the side of their page names it.
   *
   * Null where it does not: a Workflow whose `name:` two files share, a Workflow past the
   * first page of that list, and a Run whose row is read on its own in a test. A Run carries
   * this rather than the Strand or the screen because it is the one durable name a Workflow
   * has — `name:` is a line in a file somebody edits, and
   * [#26256](https://github.com/orgs/community/discussions/26256) is 419 readers saying that
   * renaming a Workflow leaves the old name on their Actions tab for good.
   */
  readonly file: string | null
  /** The Run number their page writes as `#9857`, without the hash. */
  readonly number: string
  /** The head commit's title, which is all their list gives of the commit. */
  readonly title: string
  readonly state: CheckState
  readonly seconds: number
  readonly startedAt: string
  readonly actor: string
  /** What set it off: `synchronize`, `push`, and the rest of their words. */
  readonly trigger: string
  /**
   * The ref it was against, where the row names one.
   *
   * Null where it does not, which their `Comment Cop` rows on `oven-sh/bun/actions` do not. A
   * Run like that still belongs to the pull request its row names.
   */
  readonly ref: Ref | null
  readonly pullRequest: string | null
}

/**
 * A Strand: one line of work, and every Run against it.
 *
 * The unit of the list screen. Not the Run, because twenty-five Runs on one screen described
 * ten pull requests, and not the ref either: pull request 1758 was three `ci` runs on its head
 * branch and three `CodeQL` runs on `refs/pull/1758/head`, which is one thing on two refs.
 */
export type Strand = {
  /** The pull request every Run in it belongs to, where the rows name one. */
  readonly pullRequest: string | null
  /** The head branch, where a Run in it names one. A pull ref alone gives no branch. */
  readonly branch: string | null
  /** The newest Run's commit title, which is as much of the head as their list gives. */
  readonly head: string
  /** How many Runs stand against that head, re-runs counted. */
  readonly onHead: number
  /** What the head came to: the newest Run of each workflow, newest first. */
  readonly latest: ReadonlyArray<Listed>
  /** Runs on the head that a later attempt of the same workflow answered for. */
  readonly superseded: number
  /** Runs against a commit this work has moved past. */
  readonly earlier: number
  /** The worst standing among the Runs in {@link latest}. */
  readonly state: CheckState
  /** When the newest Run started, which is what the screen orders on. */
  readonly startedAt: string
  readonly runs: ReadonlyArray<Listed>
}

const PULL = /^refs\/pull\/(\d+)\//
const HEAD = /^refs\/heads\//

const TAB = /^\/([^/]+)\/([^/]+)\/actions\/?$/

/**
 * The repository whose Actions tab an address names, or nothing.
 *
 * The tab itself only. A run has its own screen and `runAddressIn` reads it, and
 * `/actions/workflows/ci.yml` is this list filtered to one workflow, which is GitHub's until
 * this screen learns to filter. A query is allowed and ignored, because their own filters are
 * theirs: this screen groups instead of filtering.
 */
export const actionsIn = (url: string): Option.Option<RepoRef> => {
  const at = Option.liftThrowable((address: string) => new URL(address))(url)
  if (Option.isNone(at)) return Option.none()
  if (at.value.hostname !== "github.com") return Option.none()

  const named = TAB.exec(at.value.pathname)
  if (named === null) return Option.none()

  const owner = named[1] ?? ""
  const repo = named[2] ?? ""
  if (owner === "" || repo === "") return Option.none()
  return Option.some({ owner, repo })
}

/**
 * The ref a row names, read from either spelling.
 *
 * A bare name is a branch, because their list writes a head branch with the prefix taken off
 * and leaves it on a pull ref.
 */
export const refIn = (ref: string): Ref => {
  const pull = PULL.exec(ref)
  if (pull !== null) return { kind: "pull", number: pull[1] ?? "" }
  return { kind: "branch", name: ref.replace(HEAD, "") }
}

/**
 * What a Run belongs to.
 *
 * The pull request where anything names one, and the branch otherwise. A pull ref carries the
 * number in the ref itself and a branch row links it, so two Runs that agree on it are two
 * Runs of one pull request and not a guess that they might be.
 */
const belongsTo = (one: Listed): string => {
  if (one.ref?.kind === "pull") return `pull:${one.ref.number}`
  if (one.pullRequest !== null) return `pull:${one.pullRequest}`
  if (one.ref?.kind === "branch") return `branch:${one.ref.name}`
  // Neither, which the parser does not pass on. Kept apart by the Run's own id rather than
  // heaped together, because two Runs that name nothing are not thereby one piece of work.
  return `run:${one.run}`
}

const pullOf = (runs: ReadonlyArray<Listed>): string | null => {
  for (const one of runs) {
    if (one.ref?.kind === "pull") return one.ref.number
    if (one.pullRequest !== null) return one.pullRequest
  }
  return null
}

const branchOf = (runs: ReadonlyArray<Listed>): string | null => {
  for (const one of runs) if (one.ref?.kind === "branch") return one.ref.name
  return null
}

const newerFirst = (some: ReadonlyArray<Listed>): ReadonlyArray<Listed> =>
  [...some].sort((one, two) => two.startedAt.localeCompare(one.startedAt))

/**
 * What the head came to: the newest Run of each workflow, and nothing older.
 *
 * A second Run of one workflow against one commit is a re-run, and a re-run answers the
 * question the attempt before it asked. Read off the live page: a Strand whose `ci` was
 * running at that moment had a cancelled attempt behind it, and the worst of the two reported
 * the work as cancelled. Another had been fixed by a re-run and reported the failure it had
 * already answered. One result per workflow is the only reading that is true of both.
 *
 * Given newest first, which is the order they arrive in.
 */
const latestOf = (onHead: ReadonlyArray<Listed>): ReadonlyArray<Listed> => {
  const seen = new Set<string>()
  return onHead.filter((one) => {
    if (seen.has(one.workflow)) return false
    seen.add(one.workflow)
    return true
  })
}

const strandOf = (runs: ReadonlyArray<Listed>): Strand => {
  const ordered = newerFirst(runs)
  const head = ordered[0]?.title ?? ""
  const onHead = ordered.filter((one) => one.title === head)
  const latest = latestOf(onHead)

  return {
    pullRequest: pullOf(ordered),
    branch: branchOf(ordered),
    head,
    onHead: onHead.length,
    latest,
    superseded: onHead.length - latest.length,
    earlier: ordered.length - onHead.length,
    // Across workflows, where the worst really is the answer: two workflows of one commit are
    // two results, and a red one is a red head however green the other is.
    state: worstOf(latest),
    startedAt: ordered[0]?.startedAt ?? "",
    runs: ordered
  }
}

/**
 * Every Run on the page, folded into the work it belongs to, newest first.
 *
 * The order is the order their page uses, kept through the grouping, because the thing a
 * reader came for is the thing that just ran.
 */
export const strandsIn = (runs: ReadonlyArray<Listed>): ReadonlyArray<Strand> => {
  const held = new Map<string, Array<Listed>>()
  for (const one of runs) {
    const key = belongsTo(one)
    const already = held.get(key)
    if (already === undefined) held.set(key, [one])
    else already.push(one)
  }

  return [...held.values()]
    .map(strandOf)
    .sort((one, two) => two.startedAt.localeCompare(one.startedAt))
}
