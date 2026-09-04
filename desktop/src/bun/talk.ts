import { Effect } from "effect"
import type { SuggestingFacts, UploadFacts } from "../shared/wire"
import { GitHubRefused, graphRead, restRead, restUpload, restWrite } from "./api"

const SUGGEST = `
  query Suggest($owner: String!, $repo: String!, $search: String!) {
    repository(owner: $owner, name: $repo) {
      mentionableUsers(first: 50) {
        nodes { login name }
      }
    }
    search(query: $search, type: ISSUE, first: 50) {
      nodes {
        ... on Issue { number title state }
        ... on PullRequest { number title state }
      }
    }
  }
`

type SuggestAnswer = {
  readonly repository: {
    readonly mentionableUsers: {
      readonly nodes: ReadonlyArray<{ readonly login: string; readonly name: string | null } | null>
    }
  } | null
  readonly search: {
    readonly nodes: ReadonlyArray<
      | { readonly number: number; readonly title: string; readonly state: string }
      | null
    >
  }
}

export const readSuggesting = Effect.fn("readSuggesting")(function* (
  token: string,
  owner: string,
  repo: string
) {
  const answer: SuggestAnswer = yield* graphRead<SuggestAnswer>(token, SUGGEST, {
    owner,
    repo,
    search: `repo:${owner}/${repo}`
  })

  const people = (answer.repository?.mentionableUsers.nodes ?? []).flatMap((one) =>
    one === null ? [] : [{ login: one.login, name: one.name ?? one.login }]
  )
  const numbered = answer.search.nodes.flatMap((one) => {
    if (one === null || one.number === undefined) return []
    return [
      {
        number: one.number,
        title: one.title,
        state: (one.state === "CLOSED" || one.state === "MERGED" ? "closed" : "open") as "open" | "closed"
      }
    ]
  })

  const facts: SuggestingFacts = { people, numbered }
  return facts
})

const TAG = "gitquiet-uploads"

type Release = { readonly id: number }

const releaseOf = Effect.fn("releaseOf")(function* (token: string, owner: string, repo: string) {
  const existing = yield* restRead<Release>(
    token,
    `/repos/${owner}/${repo}/releases/tags/${TAG}`
  ).pipe(Effect.orElseSucceed(() => null))
  if (existing !== null) return existing

  return yield* restWrite<Release>(token, `/repos/${owner}/${repo}/releases`, {
    tag_name: TAG,
    name: "GitQuiet uploads",
    body: "Files pasted into GitQuiet comments. Safe to delete this release.",
    draft: false,
    prerelease: true
  }).pipe(
    Effect.catch((cause) => {
      if (cause instanceof GitHubRefused && cause.status === 422) {
        return restRead<Release>(token, `/repos/${owner}/${repo}/releases/tags/${TAG}`)
      }
      return Effect.fail(cause)
    })
  )
})

/**
 * A pasted file, put where a comment can name it.
 *
 * GitHub's own user-attachments route needs a session and a CSRF nonce. A PAT
 * cannot do that. A release asset on a `gitquiet-uploads` tag is the documented
 * way that still answers with an http URL the box can write.
 *
 * Needs write access on this repository. A comment on somebody else's
 * repository is refused with GitHub's sentence.
 */
export const uploadFile = Effect.fn("uploadFile")(function* (
  token: string,
  owner: string,
  repo: string,
  name: string,
  type: string,
  bytes: Uint8Array,
  width?: number,
  height?: number
) {
  const safe = name.replace(/[/\\]/g, "-").replace(/^\.+/, "")
  if (safe === "") {
    return yield* Effect.fail(new GitHubRefused(400, "That file has no name GitHub can keep."))
  }

  const release = yield* releaseOf(token, owner, repo)
  const stamped = `${Date.now()}-${safe}`
  const uploaded = yield* restUpload<{ readonly browser_download_url: string; readonly name: string }>(
    token,
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(stamped)}`,
    bytes,
    type === "" ? "application/octet-stream" : type
  )

  const facts: UploadFacts = {
    name: uploaded.name,
    href: uploaded.browser_download_url,
    ...(width !== undefined && height !== undefined ? { width, height } : {})
  }
  return facts
})
