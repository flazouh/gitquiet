/**
 * Put Away: the Workflows a reader has decided their Actions screens should not show.
 *
 * Four discussions on GitHub's own board are one request, and all four are labelled In Backlog:
 * mark a reusable Workflow so it stops appearing under the Actions tab
 * ([#12025](https://github.com/orgs/community/discussions/12025), 884 upvotes), delete or hide
 * an old or renamed one ([#26256](https://github.com/orgs/community/discussions/26256), 419),
 * and two asking for Workflows to be organised and separated by the folder they are in
 * ([#15935](https://github.com/orgs/community/discussions/15935), 578, and
 * [#11831](https://github.com/orgs/community/discussions/11831), 400). The first two are a
 * reader's own decision about a Workflow, and this is that decision. The other two are not
 * answered here and cannot be answered anywhere: GitHub's own documentation says
 * "Subdirectories of the `workflows` directory are not supported", so the folders those threads
 * ask to be grouped by do not exist in a repository whose Workflows run at all.
 *
 * Their own answer to the same question is the Workflow filter beside their rows, which holds
 * one value, applies to nothing but the list, and is gone on the next page load. This is
 * remembered per Participant, and `src/ui/place.ts` argues on the `ACTIONS` place why the
 * screen groups instead of growing a filter of its own.
 */

import type { RepoRef } from "./PullRequestRef"
import { type Listed, type Strand, strandsIn } from "./strand"

/**
 * The name one Workflow is put away under.
 *
 * The file where their page named one, because that is the name that outlives an edit: a
 * Workflow's `name:` is a line in the file and renaming it is what
 * [#26256](https://github.com/orgs/community/discussions/26256) is about. The `name:` itself
 * where the file is unknown, which happens for a Workflow past the first page of their sidebar
 * and for one whose name two files share. That decision is then only as durable as the name,
 * and it is still the name the reader pressed.
 */
export const putAwayKey = (one: Listed): string => one.file ?? one.workflow

/** One Workflow of one repository, in the form the settings record keeps. */
export const putAwayEntry = (repo: RepoRef, key: string): string =>
  `${repo.owner}/${repo.repo}:${key}`

/**
 * The Workflows put away in one repository, out of every one the reader has put away anywhere.
 *
 * Split on the first colon only. A Workflow put away under its own `name:` may carry one, and
 * "Code Quality: PR" is a real name off `octo-repo`. A repository address cannot carry one.
 */
export const putAwayIn = (
  kept: ReadonlyArray<string>,
  repo: RepoRef
): ReadonlyArray<string> => {
  const here = `${repo.owner}/${repo.repo}:`
  return kept.filter((one) => one.startsWith(here)).map((one) => one.slice(here.length))
}

/** One Workflow that is away, as the line saying so needs it. */
export type Away = {
  readonly key: string
  /** Its own name, where a Run on this page carries one. The key itself where none does. */
  readonly workflow: string
  /** How many Runs of it this page carried. None, where it has not run lately. */
  readonly runs: number
}

export type Curation = {
  readonly strands: ReadonlyArray<Strand>
  /** What is away, in the order the reader put them away. */
  readonly away: ReadonlyArray<Away>
}

/**
 * The list again, with every Run of a put-away Workflow taken out of it.
 *
 * Folded a second time rather than filtered in place, because every number on a Strand is an
 * answer about which Runs are on the screen: which commit is the head, how many Runs stand
 * against it, how many attempts were superseded, and what the work came to. A Strand that kept
 * a standing worked out from a Run nobody can see would be the fault this screen exists to
 * remove, drawn by us instead of by them.
 *
 * Applied here and not where the list is read, so the read stays whole. The list is kept
 * between visits, and a reader bringing a Workflow back is answered from what is already in the
 * store rather than by a second trip to GitHub.
 */
export const curated = (
  strands: ReadonlyArray<Strand>,
  keys: ReadonlyArray<string>
): Curation => {
  const runs = strands.flatMap((one) => one.runs)
  if (keys.length === 0) return { strands, away: [] }

  const away = new Set(keys)
  const kept = runs.filter((one) => !away.has(putAwayKey(one)))
  const taken = runs.filter((one) => away.has(putAwayKey(one)))

  return {
    strands: strandsIn(kept),
    away: keys.map((key) => {
      const of = taken.filter((one) => putAwayKey(one) === key)
      return { key, workflow: of[0]?.workflow ?? key, runs: of.length }
    })
  }
}
