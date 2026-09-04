import { Effect } from "effect"
import type { RepositoryFacts } from "../shared/wire"
import { graphRead } from "./api"

const REPOS = `
  query Repositories($after: String) {
    viewer {
      repositories(first: 100, after: $after, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          nameWithOwner
          isPrivate
          isEmpty
          owner { login avatarUrl __typename }
        }
      }
    }
  }
`

type ReposAnswer = {
  readonly viewer: {
    readonly repositories: {
      readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null }
      readonly nodes: ReadonlyArray<{
        readonly name: string
        readonly nameWithOwner: string
        readonly isPrivate: boolean
        readonly isEmpty: boolean
        readonly owner: { readonly login: string; readonly avatarUrl: string | null; readonly __typename: string }
      } | null>
    }
  }
}

export const readRepositories = Effect.fn("readRepositories")(function* (token: string) {
  const all: Array<RepositoryFacts> = []
  let after: string | null = null

  for (;;) {
    const vars: { readonly after: string | null } = { after }
    const answer: ReposAnswer = yield* graphRead<ReposAnswer>(token, REPOS, vars)

    for (const one of answer.viewer.repositories.nodes) {
      if (one === null) continue
      const [owner, repo] = one.nameWithOwner.split("/")
      if (owner === undefined || repo === undefined) continue
      all.push({
        owner,
        repo,
        nameWithOwner: one.nameWithOwner,
        faceUrl: one.owner.avatarUrl,
        ofAnOrganisation: one.owner.__typename === "Organization",
        isPrivate: one.isPrivate,
        isEmpty: one.isEmpty
      })
    }

    if (!answer.viewer.repositories.pageInfo.hasNextPage) break
    after = answer.viewer.repositories.pageInfo.endCursor
    if (after === null) break
    if (all.length >= 400) break
  }

  return all
})
