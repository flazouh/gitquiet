import { Effect } from "effect"
import { restRead } from "./api"

type RestCommit = {
  readonly sha: string
  readonly html_url: string
  readonly commit: {
    readonly message: string
    readonly author: { readonly date: string } | null
  }
  readonly author: { readonly login: string; readonly avatar_url: string | null } | null
}

export const readTreeCommits = Effect.fn("readTreeCommits")(function* (
  token: string,
  owner: string,
  repo: string,
  sha: string,
  folder?: string
) {
  const tree = yield* restRead<{
    readonly tree: ReadonlyArray<{ readonly path: string; readonly type: string }>
  }>(token, `/repos/${owner}/${repo}/git/trees/${sha}`)

  const prefix = folder === undefined || folder === "" ? "" : `${folder.replace(/\/$/, "")}/`
  const entries = tree.tree.filter((one) =>
    prefix === "" ? !one.path.includes("/") : one.path.startsWith(prefix) && !one.path.slice(prefix.length).includes("/")
  )

  const touches = yield* Effect.all(
    entries.map((one) =>
      Effect.gen(function* () {
        const listed = yield* restRead<ReadonlyArray<RestCommit>>(
          token,
          `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&path=${encodeURIComponent(one.path)}&per_page=1`
        )
        const commit = listed[0]
        if (commit === undefined) return null
        const name = prefix === "" ? one.path : one.path.slice(prefix.length)
        return [
          name,
          {
            at: commit.commit.author?.date ?? "",
            said: commit.commit.message.split("\n")[0] ?? "",
            url: commit.html_url,
            oid: commit.sha,
            who: commit.author === null ? null : { login: commit.author.login, face: commit.author.avatar_url }
          }
        ] as const
      })
    ),
    { concurrency: 6 }
  )

  return touches.flatMap((one) => (one === null ? [] : [one]))
})
