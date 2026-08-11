import { Effect } from "effect"
import type { CommitDetailFacts, FileFacts } from "../shared/wire"
import { restRead } from "./api"

/**
 * One commit, as the documented API answers it.
 *
 * The extension reads GitHub's private commit page. This window has a token and
 * no session, so it uses `GET /repos/.../commits/{sha}`, which already carries
 * the files and most of their patches. That is enough for the commit panel.
 */

export type { CommitDetailFacts }

type RestCommitFile = {
  readonly filename: string
  readonly sha: string | null
  readonly status: string
  readonly additions: number
  readonly deletions: number
  readonly changes: number
  readonly patch?: string
  readonly previous_filename?: string
}

type RestCommit = {
  readonly sha: string
  readonly commit: {
    readonly message: string
    readonly author: { readonly name: string | null; readonly date: string } | null
  }
  readonly author: { readonly login: string; readonly avatar_url: string } | null
  readonly files?: ReadonlyArray<RestCommitFile>
}

const CHANGES: Record<string, FileFacts["changeType"]> = {
  added: "added",
  removed: "deleted",
  modified: "modified",
  renamed: "renamed",
  copied: "copied",
  changed: "changed"
}

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const bodyHtmlOf = (message: string): string | null => {
  const broke = message.indexOf("\n")
  if (broke < 0) return null
  const body = message.slice(broke + 1).replace(/^\n+/, "").trimEnd()
  if (body === "") return null
  return `<pre>${escapeHtml(body)}</pre>`
}

const fileOf = (rest: RestCommitFile): FileFacts => {
  const patch = rest.patch ?? null
  const content: FileFacts["content"] =
    patch === null ? (rest.changes > 0 ? "withheld" : "binary") : "here"

  return {
    path: rest.filename,
    digest: rest.sha ?? rest.filename,
    changeType: CHANGES[rest.status] ?? "changed",
    linesAdded: rest.additions,
    linesDeleted: rest.deletions,
    readByViewer: false,
    content,
    patch: content === "here" ? patch : null
  }
}

/** Pure mapping from GitHub's REST commit payload to wire facts. */
export const commitFromRest = (raw: RestCommit): CommitDetailFacts => {
  const message = raw.commit.message
  const broke = message.indexOf("\n")
  const headline = (broke < 0 ? message : message.slice(0, broke)).trimEnd()

  return {
    sha: raw.sha,
    abbreviatedSha: raw.sha.slice(0, 7),
    headline,
    bodyHtml: bodyHtmlOf(message),
    author: raw.author?.login ?? raw.commit.author?.name ?? "ghost",
    avatarUrl: raw.author?.avatar_url ?? null,
    createdAt: raw.commit.author?.date ?? "",
    files: (raw.files ?? []).map(fileOf)
  }
}

export const readCommit = Effect.fn("readCommit")(function* (
  token: string,
  owner: string,
  repo: string,
  sha: string
) {
  const raw = yield* restRead<RestCommit>(token, `/repos/${owner}/${repo}/commits/${sha}`)
  return commitFromRest(raw)
})
