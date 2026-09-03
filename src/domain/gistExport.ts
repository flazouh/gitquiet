import type { KeptGists } from "./gistLabels"
import { labelsOf, nameOf } from "./gistLabels"
import type { GistRow } from "./gistList"

/**
 * A reader's own gists, written out as a file they keep.
 *
 * GitHub's account export does not include gist data at all — which is why at least
 * five separate "delete all your gists" and "archive my gists" scripts are themselves
 * published as gists, and why `github-takeout` exists as a project. The reader who has
 * two hundred gists has no supported way to hold a copy of them.
 *
 * This screen has already read every page of that list to search it, so the export is
 * the thing it is already holding, written down. It also carries the two fields GitHub
 * could never export, because GitHub does not have them: a Label and a Name.
 *
 * What it is not is a backup of the files. The list page carries a preview of each
 * gist's content and not the whole of it, and a reader told this was a backup would
 * find that out at the worst possible moment. The shape below says `preview` for that
 * reason, and `docs/spec/gists.md` says it in words.
 */

export type ExportedGist = {
  readonly id: string
  readonly owner: string
  readonly url: string
  /** GitHub's own name for it, which is its first filename by ASCII sort. */
  readonly title: string
  /** What this reader called it, where they called it anything. */
  readonly name: string | null
  readonly labels: ReadonlyArray<string>
  readonly description: string | null
  readonly secret: boolean
  readonly updatedAt: string
  readonly files: number
  readonly forks: number
  readonly stars: number
  readonly comments: number
  /** What their list page showed of the content. Not the files themselves. */
  readonly preview: string
}

export type Exported = {
  readonly exportedAt: string
  /** Whether every page of their list was read, so a short export says it is short. */
  readonly whole: boolean
  readonly gists: ReadonlyArray<ExportedGist>
}

export const exported = (
  rows: ReadonlyArray<GistRow>,
  kept: KeptGists,
  whole: boolean,
  now: Date = new Date()
): Exported => ({
  exportedAt: now.toISOString(),
  whole,
  gists: rows.map((row) => ({
    id: row.id,
    owner: row.owner,
    url: `https://gist.github.com/${row.owner}/${row.id}`,
    title: row.title,
    name: nameOf(kept, row.id),
    labels: labelsOf(kept, row.id),
    description: row.description,
    secret: row.secret,
    updatedAt: row.updatedAt,
    files: row.files,
    forks: row.forks,
    stars: row.stars,
    comments: row.comments,
    preview: row.preview
  }))
})
