import { Effect } from "effect"
import type { FaceFacts, MarkFacts } from "../shared/wire"
import { graphRead, restRead } from "./api"

type RestCommit = {
  readonly sha: string
  readonly html_url: string
  readonly commit: {
    readonly message: string
    readonly author: { readonly name: string; readonly date: string } | null
    readonly committer: { readonly name: string; readonly date: string } | null
  }
  readonly author: { readonly login: string; readonly avatar_url: string | null } | null
  readonly committer: { readonly login: string; readonly avatar_url: string | null } | null
  readonly parents: ReadonlyArray<{ readonly sha: string }>
}

const PULL = /\(#(\d+)\)\s*$/

const dayTitle = (iso: string): string => {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return `Commits on ${at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  })}`
}

export type LandedFacts = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  readonly bodyHtml: string | null
  readonly authors: ReadonlyArray<FaceFacts>
  readonly committer: FaceFacts | null
  readonly pullRequest: number | null
  readonly createdAt: string
}

export type HistoryFacts = {
  readonly branch: string
  readonly days: ReadonlyArray<{ readonly title: string; readonly commits: ReadonlyArray<LandedFacts> }>
  readonly older: string | null
  readonly newer: string | null
  /** The shas of this page, joined, so the marks read can ask for them. */
  readonly rest: string | null
}

const faceOf = (login: string, url: string | null | undefined): FaceFacts => ({
  login,
  isAutomated: login.endsWith("[bot]"),
  faceUrl: url ?? null
})

const landedOf = (one: RestCommit): LandedFacts => {
  const [headline, ...rest] = one.commit.message.split("\n")
  const body = rest.join("\n").trim()
  const pull = PULL.exec(headline ?? "")
  const writer = one.author?.login ?? one.commit.author?.name ?? "ghost"
  const committerLogin = one.committer?.login ?? one.commit.committer?.name ?? writer

  return {
    sha: one.sha,
    abbreviatedSha: one.sha.slice(0, 7),
    headline: headline ?? one.sha,
    bodyHtml: body === "" ? null : `<pre>${body}</pre>`,
    authors: [faceOf(writer, one.author?.avatar_url)],
    committer: committerLogin === writer ? null : faceOf(committerLogin, one.committer?.avatar_url),
    pullRequest: pull?.[1] === undefined ? null : Number(pull[1]),
    createdAt: one.commit.author?.date ?? one.commit.committer?.date ?? ""
  }
}

export const readCommits = Effect.fn("readCommits")(function* (
  token: string,
  owner: string,
  repo: string,
  branch: string | undefined,
  search: string
) {
  const asked = new URLSearchParams(search)
  const page = Number(asked.get("page") ?? "1")
  const author = asked.get("author")
  const since = asked.get("since")
  const until = asked.get("until")

  const query = new URLSearchParams({ per_page: "35", page: String(Number.isFinite(page) ? page : 1) })
  if (branch !== undefined) query.set("sha", branch)
  if (author !== null && author !== "") query.set("author", author)
  if (since !== null && since !== "") query.set("since", since)
  if (until !== null && until !== "") query.set("until", until)

  const listed = yield* restRead<ReadonlyArray<RestCommit>>(
    token,
    `/repos/${owner}/${repo}/commits?${query.toString()}`
  )

  const days: Array<{ title: string; commits: Array<LandedFacts> }> = []
  for (const one of listed) {
    const landed = landedOf(one)
    const title = dayTitle(landed.createdAt)
    const last = days[days.length - 1]
    if (last !== undefined && last.title === title) last.commits.push(landed)
    else days.push({ title, commits: [landed] })
  }

  const at = Number.isFinite(page) ? page : 1
  const shas = listed.map((one) => one.sha)
  const history: HistoryFacts = {
    branch: branch ?? "HEAD",
    days,
    older: listed.length < 35 ? null : String(at + 1),
    newer: at <= 1 ? null : String(at - 1),
    rest: shas.length === 0 ? null : shas.join(",")
  }
  return history
})

export const readCommitStat = Effect.fn("readCommitStat")(function* (
  token: string,
  owner: string,
  repo: string,
  sha: string
) {
  const commit = yield* restRead<{
    readonly stats?: { readonly additions: number; readonly deletions: number }
    readonly files?: ReadonlyArray<unknown>
  }>(token, `/repos/${owner}/${repo}/commits/${sha}`)

  if (commit.stats === undefined || commit.files === undefined) return null

  return {
    files: commit.files.length,
    added: commit.stats.additions,
    removed: commit.stats.deletions
  }
})

export const readWhoTouched = Effect.fn("readWhoTouched")(function* (
  token: string,
  owner: string,
  repo: string,
  sha: string
) {
  const commit = yield* restRead<RestCommit>(token, `/repos/${owner}/${repo}/commits/${sha}`)
  const login = commit.author?.login
  if (login === undefined) return null
  return { login, face: commit.author?.avatar_url ?? null }
})

export const readAuthors = Effect.fn("readAuthors")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const listed = yield* restRead<ReadonlyArray<RestCommit>>(
    token,
    `/repos/${owner}/${repo}/commits?per_page=100`
  )

  const seen = new Map<string, FaceFacts>()
  for (const one of listed) {
    const login = one.author?.login
    if (login === undefined || seen.has(login)) continue
    seen.set(login, faceOf(login, one.author?.avatar_url))
  }
  return [...seen.values()]
})

const rollupOf = (state: string | undefined): MarkFacts["checks"] => {
  if (state === undefined) return null
  if (state === "SUCCESS" || state === "EXPECTED") return { state: "passing", said: "Checks passed" }
  if (state === "PENDING") return { state: "running", said: "Checks running" }
  return { state: "failing", said: "Checks failed" }
}

const MARKS = (oids: ReadonlyArray<string>): string => {
  const fields = oids.map(
    (oid, at) => `
      c${at}: object(oid: "${oid}") {
        ... on Commit {
          oid
          signature { isValid }
          comments { totalCount }
          statusCheckRollup { state }
        }
      }`
  )
  return `query Marks($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) { ${fields.join("\n")} }
  }`
}

type MarkNode = {
  readonly oid: string
  readonly signature: { readonly isValid: boolean } | null
  readonly comments: { readonly totalCount: number }
  readonly statusCheckRollup: { readonly state: string } | null
}

/**
 * Checks, signatures and comment counts for the shas a history page named.
 *
 * The route on the extension is a deferred HTML path. Here `rest` is the shas
 * themselves, joined, which is what `readCommits` writes into History.rest.
 */
export const readCommitMarks = Effect.fn("readCommitMarks")(function* (
  token: string,
  owner: string,
  repo: string,
  rest: string
) {
  const oids = rest.split(",").filter((one) => one.length > 0)
  const marks: Array<MarkFacts> = []

  for (let at = 0; at < oids.length; at += 10) {
    const batch = oids.slice(at, at + 10)
    const answer = yield* graphRead<{ readonly repository: Record<string, MarkNode | null> | null }>(
      token,
      MARKS(batch),
      { owner, repo }
    )
    const found = answer.repository
    if (found === null) continue
    for (const one of Object.values(found)) {
      if (one === null) continue
      marks.push({
        sha: one.oid,
        checks: rollupOf(one.statusCheckRollup?.state),
        verified: one.signature?.isValid === true,
        comments: one.comments.totalCount
      })
    }
  }

  return marks
})
