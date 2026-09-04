import { Effect } from "effect"
import type { Attached, Version } from "../../../src/domain/release"
import { formIn, platformIn } from "../../../src/domain/release"
import { restEmpty, restRead } from "./api"

const SAID = /^(.*?)\s+by\s+@(\S+)\s+in\s+(?:#(\d+)|https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+))\s*$/gm

const sizeOf = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const changesIn = (body: string, owner: string, repo: string) => {
  const found: Array<{
    readonly title: string
    readonly author: string
    readonly pullRequest: string
    readonly url: string
  }> = []
  for (const match of body.matchAll(SAID)) {
    const title = match[1]
    const author = match[2]
    const number = match[3] ?? match[4]
    if (title === undefined || author === undefined || number === undefined) continue
    found.push({
      title,
      author,
      pullRequest: number,
      url: `https://github.com/${owner}/${repo}/pull/${number}`
    })
  }
  return found
}

const remarkIn = (body: string): string =>
  body
    .replace(/^## What's Changed\s*/i, "")
    .replace(SAID, "")
    .replace(/^\s*Full Changelog:.*$/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

export const starRepository = Effect.fn("starRepository")(function* (
  token: string,
  owner: string,
  repo: string,
  to: "starred" | "unstarred"
) {
  const route = `/user/starred/${owner}/${repo}`
  yield* restEmpty(token, route, to === "starred" ? "PUT" : "DELETE")
})

export const readBranches = Effect.fn("readBranches")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const names: Array<string> = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = yield* restRead<ReadonlyArray<{ readonly name: string }>>(
      token,
      `/repos/${owner}/${repo}/branches?per_page=100&page=${page}`
    )
    for (const one of batch) names.push(one.name)
    if (batch.length < 100) break
  }
  return names
})

type RestRelease = {
  readonly tag_name: string
  readonly name: string | null
  readonly html_url: string
  readonly published_at: string | null
  readonly created_at: string
  readonly author: { readonly login: string } | null
  readonly prerelease: boolean
  readonly body: string | null
}

export const readReleases = Effect.fn("readReleases")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const listed = yield* restRead<ReadonlyArray<RestRelease>>(
    token,
    `/repos/${owner}/${repo}/releases?per_page=10`
  )

  return listed.map((one, at): Version => {
    const body = one.body ?? ""
    return {
      tag: one.tag_name,
      title: one.name ?? one.tag_name,
      url: one.html_url,
      at: one.published_at ?? one.created_at,
      author: one.author?.login ?? "ghost",
      prerelease: one.prerelease,
      latest: at === 0 && !one.prerelease,
      changes: changesIn(body, owner, repo),
      remark: remarkIn(body)
    }
  })
})

type RestAsset = {
  readonly name: string
  readonly browser_download_url: string
  readonly size: number
  readonly digest?: string | null
}

export const readBuilds = Effect.fn("readBuilds")(function* (
  token: string,
  owner: string,
  repo: string,
  tag: string
) {
  const release = yield* restRead<{
    readonly zipball_url: string
    readonly tarball_url: string
    readonly assets: ReadonlyArray<RestAsset>
  }>(token, `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`)

  const attached: Attached = {
    builds: release.assets.map((one) => ({
      name: one.name,
      url: one.browser_download_url,
      size: sizeOf(one.size),
      digest: one.digest ?? null,
      platform: platformIn(one.name),
      form: formIn(one.name)
    })),
    archives: [
      { kind: "zip", url: release.zipball_url },
      { kind: "tar.gz", url: release.tarball_url }
    ]
  }
  return attached
})
