/**
 * What is kept of a commit between visits, and what is left behind.
 *
 * A commit is the one page of ours that used to open cold every time, and it is also the
 * one whose read is a whole document of GitHub's: their page carries the message, the
 * author, every changed file and the diffs for as many of them as fit inside a byte
 * budget. Keeping all of that would put most of a megabyte per commit into a store shared
 * with every other page, so the facts and the file names are kept and the diffs are not.
 *
 * Which loses nothing the reader waits for twice. A file with no content is the shape
 * GitHub itself sends for everything past its budget, and the screen already fills those
 * in when they are opened — so a commit opened again draws its header, its message and its
 * whole tree at once, and reads the file being looked at.
 *
 * The `Option`s go in as nulls and are built again on the way out, for the reason
 * `KeptFront` gives next door: JSON turns one into an object that resembles an `Option`
 * closely enough to be handed to a screen and fail there.
 */

import { Option } from "effect"
import type { ChangedFile, ChangeType, CommitDetail } from "../domain/PullRequest"

export type KeptCommit = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  readonly bodyHtml: string | null
  readonly author: string
  readonly avatarUrl: string | null
  readonly createdAt: string
  readonly files: ReadonlyArray<{
    readonly path: string
    readonly digest: string
    readonly changeType: ChangeType
    readonly linesAdded: number
    readonly linesDeleted: number
    readonly readByViewer: boolean
  }>
}

export const keptCommitFrom = (detail: CommitDetail): KeptCommit => ({
  sha: detail.sha,
  abbreviatedSha: detail.abbreviatedSha,
  headline: detail.headline,
  bodyHtml: Option.getOrNull(detail.bodyHtml),
  author: detail.author,
  avatarUrl: Option.getOrNull(detail.avatarUrl),
  createdAt: detail.createdAt,
  files: detail.files.map((one) => ({
    path: one.path,
    digest: one.digest,
    changeType: one.changeType,
    linesAdded: one.linesAdded,
    linesDeleted: one.linesDeleted,
    readByViewer: one.readByViewer
  }))
})

/**
 * The commit an entry stands for, or nothing where the entry is not one.
 *
 * Checked rather than trusted because the store outlives the code: an entry written by a
 * version of this extension that has since been updated is exactly the shape that would
 * otherwise be handed to a screen and fail there.
 */
export const commitFromKept = (value: unknown): Option.Option<CommitDetail> => {
  if (typeof value !== "object" || value === null) return Option.none()

  const kept: Partial<KeptCommit> = value
  if (
    typeof kept.sha !== "string" ||
    typeof kept.abbreviatedSha !== "string" ||
    typeof kept.headline !== "string" ||
    typeof kept.author !== "string" ||
    typeof kept.createdAt !== "string" ||
    !Array.isArray(kept.files)
  ) {
    return Option.none()
  }

  const files: Array<ChangedFile> = []
  for (const one of kept.files) {
    if (typeof one?.path !== "string" || typeof one.digest !== "string") return Option.none()

    files.push({
      path: one.path,
      digest: one.digest,
      changeType: one.changeType,
      linesAdded: one.linesAdded,
      linesDeleted: one.linesDeleted,
      readByViewer: one.readByViewer,
      diff: Option.none()
    })
  }

  return Option.some({
    sha: kept.sha,
    abbreviatedSha: kept.abbreviatedSha,
    headline: kept.headline,
    bodyHtml: Option.fromNullishOr(kept.bodyHtml),
    author: kept.author,
    avatarUrl: Option.fromNullishOr(kept.avatarUrl),
    createdAt: kept.createdAt,
    files
  })
}
