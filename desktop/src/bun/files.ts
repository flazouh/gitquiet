import { Effect } from "effect"
import { graphRead, restRead, restText } from "./api"

const BLAME = `
  query Blame($owner: String!, $repo: String!, $expression: String!, $path: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expression) {
        ... on Commit {
          blame(path: $path) {
            ranges {
              startingLine
              endingLine
              commit {
                oid
                message
                committedDate
                author { avatarUrl }
                committer { name email }
              }
            }
          }
        }
      }
    }
  }
`

type BlameAnswer = {
  readonly repository: {
    readonly object: {
      readonly blame: {
        readonly ranges: ReadonlyArray<{
          readonly startingLine: number
          readonly endingLine: number
          readonly commit: {
            readonly oid: string
            readonly message: string
            readonly committedDate: string
            readonly author: { readonly avatarUrl: string } | null
            readonly committer: { readonly name: string; readonly email: string } | null
          }
        }>
      }
    } | null
  } | null
}

export const readTreePaths = Effect.fn("readTreePaths")(function* (
  token: string,
  owner: string,
  repo: string,
  sha: string
) {
  const tree = yield* restRead<{
    readonly tree: ReadonlyArray<{ readonly path?: string; readonly type: string }>
  }>(token, `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`)

  return tree.tree.flatMap((one) => (one.path === undefined ? [] : [one.path]))
})

export const readFileAt = Effect.fn("readFileAt")(function* (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string
) {
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  const raw = yield* restText(
    token,
    `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`
  )

  let rendered: string | null = null
  if (/\.(md|markdown)$/i.test(path)) {
    rendered = yield* restText(
      token,
      `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
      "application/vnd.github.html"
    )
  }

  return {
    path,
    lines: raw === "" ? [] : raw.replace(/\n$/, "").split("\n"),
    rendered
  }
})

export const readRawFileAt = Effect.fn("readRawFileAt")(function* (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string
) {
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  return yield* restText(
    token,
    `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`
  )
})

export const readBlameAt = Effect.fn("readBlameAt")(function* (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string
) {
  const lines = (yield* readRawFileAt(token, owner, repo, branch, path)).replace(/\n$/, "").split("\n")
  const answer: BlameAnswer = yield* graphRead<BlameAnswer>(token, BLAME, {
    owner,
    repo,
    expression: branch,
    path
  })

  const ranges = answer.repository?.object?.blame.ranges ?? []
  const commits = new Map(
    ranges.map((one) => [
      one.commit.oid,
      {
        oid: one.commit.oid,
        message: one.commit.message,
        authorAvatarUrl: one.commit.author?.avatarUrl ?? "",
        committerName: one.commit.committer?.name ?? "",
        committerEmail: one.commit.committer?.email ?? "",
        committedDate: one.commit.committedDate
      }
    ])
  )

  return {
    ranges: ranges.map((one) => ({
      start: one.startingLine,
      end: one.endingLine,
      commitOid: one.commit.oid
    })),
    commits: [...commits.values()],
    lines
  }
})
