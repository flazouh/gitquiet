import { Effect } from "effect"
import type {
  Card,
  FaceFacts,
  FoundIssueFacts,
  IssueFacts,
  ListedIssueFacts,
  RemarkFacts
} from "../shared/wire"
import { graphRead, restWrite } from "./api"

/**
 * Issues, from the documented API.
 *
 * The extension reads GitHub's persisted issue query and posts their private
 * mutations. This window has a token and no page, so the same facts come from
 * GraphQL and REST instead. The screen cannot tell.
 */

const FACE = `
  fragment face on Actor {
    login
    __typename
    avatarUrl
  }
`

const ISSUE = `
  ${FACE}
  query Issue($owner: String!, $repo: String!, $number: Int!) {
    viewer { login __typename avatarUrl }
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        title
        body
        bodyHTML
        state
        stateReason
        createdAt
        locked
        viewerCanUpdate
        viewerCanLabel
        viewerCanAssign
        author { ...face }
        labels(first: 50) { nodes { name color description } }
        assignees(first: 20) { nodes { login avatarUrl } }
        comments(first: 100) {
          nodes {
            id
            body
            bodyHTML
            createdAt
            author { ...face }
          }
        }
        reactionGroups {
          content
          viewerHasReacted
          reactors { totalCount }
        }
      }
    }
  }
`

const SEARCH = `
  ${FACE}
  query IssueSearch($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: 10, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Issue {
          id
          number
          title
          state
          createdAt
          comments { totalCount }
          author { ...face }
          repository { name owner { login } }
          labels(first: 10) { nodes { name } }
        }
      }
    }
  }
`

type Actor = { readonly login: string; readonly __typename: string; readonly avatarUrl: string | null } | null

const faceOf = (actor: Actor): FaceFacts => ({
  login: actor?.login ?? "ghost",
  isAutomated: actor?.__typename === "Bot",
  faceUrl: actor?.avatarUrl ?? null
})

const CLOSING: Record<string, IssueFacts["closing"]> = {
  COMPLETED: "completed",
  NOT_PLANNED: "discarded",
  DUPLICATE: "duplicate"
}

const QUERY_OF = {
  assigned: "is:issue assignee:@me archived:false",
  authored: "is:issue author:@me archived:false",
  mentioned: "is:issue mentions:@me archived:false"
} as const

const listedOf = (node: {
  readonly id: string
  readonly number: number
  readonly title: string
  readonly state: string
  readonly createdAt: string
  readonly comments: { readonly totalCount: number }
  readonly author: Actor
  readonly repository: { readonly name: string; readonly owner: { readonly login: string } }
  readonly labels: { readonly nodes: ReadonlyArray<{ readonly name: string } | null> | null }
}): ListedIssueFacts => ({
  id: node.id,
  owner: node.repository.owner.login,
  repo: node.repository.name,
  number: node.number,
  title: node.title,
  author: faceOf(node.author),
  state: node.state === "CLOSED" ? "closed" : "open",
  comments: node.comments.totalCount,
  labels: (node.labels.nodes ?? []).flatMap((one) => (one === null ? [] : [one.name])),
  raisedAt: node.createdAt
})

export const readIssue = Effect.fn("readIssue")(function* (token: string, card: Card) {
  const answer = yield* graphRead<{
    readonly viewer: Actor
    readonly repository: {
      readonly issue: {
        readonly id: string
        readonly title: string
        readonly body: string
        readonly bodyHTML: string
        readonly state: string
        readonly stateReason: string | null
        readonly createdAt: string
        readonly locked: boolean
        readonly viewerCanUpdate: boolean
        readonly viewerCanLabel: boolean
        readonly viewerCanAssign: boolean
        readonly author: Actor
        readonly labels: {
          readonly nodes: ReadonlyArray<{
            readonly name: string
            readonly color: string
            readonly description: string | null
          } | null>
        }
        readonly assignees: {
          readonly nodes: ReadonlyArray<{ readonly login: string; readonly avatarUrl: string | null } | null>
        }
        readonly comments: {
          readonly nodes: ReadonlyArray<{
            readonly id: string
            readonly body: string
            readonly bodyHTML: string
            readonly createdAt: string
            readonly author: Actor
          } | null>
        }
        readonly reactionGroups: ReadonlyArray<{
          readonly content: string
          readonly viewerHasReacted: boolean
          readonly reactors: { readonly totalCount: number }
        }>
      } | null
    } | null
  }>(token, ISSUE, { owner: card.owner, repo: card.repo, number: card.number })

  const issue = answer.repository?.issue
  if (issue === undefined || issue === null) {
    return yield* Effect.fail(
      new Error(`GitHub has no issue ${card.owner}/${card.repo}#${card.number}`)
    )
  }

  const closed = issue.state === "CLOSED"
  const facts: IssueFacts = {
    id: issue.id,
    owner: card.owner,
    repo: card.repo,
    number: card.number,
    title: issue.title,
    markdown: issue.body,
    html: issue.bodyHTML,
    state: closed ? "closed" : "open",
    closing: closed ? (CLOSING[issue.stateReason ?? ""] ?? "completed") : null,
    openedAt: issue.createdAt,
    author: faceOf(issue.author),
    labels: issue.labels.nodes.flatMap((one) =>
      one === null ? [] : [{ name: one.name, colour: one.color, description: one.description }]
    ),
    assignees: issue.assignees.nodes.flatMap((one) =>
      one === null
        ? []
        : [{ login: one.login, isAutomated: false, faceUrl: one.avatarUrl }]
    ),
    remarks: issue.comments.nodes.flatMap((one): ReadonlyArray<RemarkFacts> =>
      one === null
        ? []
        : [{ id: one.id, author: faceOf(one.author), body: one.body, html: one.bodyHTML, createdAt: one.createdAt }]
    ),
    reactions: issue.reactionGroups
      .filter((one) => one.reactors.totalCount > 0)
      .map((one) => ({
        kind: one.content,
        count: one.reactors.totalCount,
        viewerReacted: one.viewerHasReacted
      })),
    allowed: {
      comment: !issue.locked,
      close: issue.viewerCanUpdate && !closed,
      reopen: issue.viewerCanUpdate && closed,
      label: issue.viewerCanLabel,
      assign: issue.viewerCanAssign
    },
    viewer: faceOf(answer.viewer)
  }

  return facts
})

export const readInvolvedIssues = Effect.fn("readInvolvedIssues")(function* (
  token: string,
  involvement: keyof typeof QUERY_OF
) {
  const found = yield* searchPage(token, QUERY_OF[involvement], 1)
  return found.rows
})

export const searchIssues = Effect.fn("searchIssues")(function* (
  token: string,
  query: string,
  page: number
) {
  return yield* searchPage(token, `${query} is:issue`, page)
})

type SearchNode = {
  readonly id: string
  readonly number: number
  readonly title: string
  readonly state: string
  readonly createdAt: string
  readonly comments: { readonly totalCount: number }
  readonly author: Actor
  readonly repository: { readonly name: string; readonly owner: { readonly login: string } }
  readonly labels: { readonly nodes: ReadonlyArray<{ readonly name: string } | null> | null }
}

type SearchAnswer = {
  readonly search: {
    readonly issueCount: number
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null }
    readonly nodes: ReadonlyArray<SearchNode | Record<string, never> | null>
  }
}

const searchPage = Effect.fn("searchPage")(function* (token: string, query: string, page: number) {
  let after: string | null = null
  let last: FoundIssueFacts = { rows: [], current: page, total: 1, count: 0 }

  for (let at = 1; at <= page; at += 1) {
    const vars: { readonly query: string; readonly after: string | null } = { query, after }
    const answer: SearchAnswer = yield* graphRead<SearchAnswer>(token, SEARCH, vars)

    const isIssue = (one: SearchAnswer["search"]["nodes"][number]): one is SearchNode =>
      one !== null && "number" in one && typeof one.number === "number"

    const nodes = answer.search.nodes.filter(isIssue).map(listedOf)
    const count = answer.search.issueCount
    last = {
      rows: nodes,
      current: at,
      total: Math.max(1, Math.ceil(count / 10)),
      count
    }
    if (at === page) return last
    if (!answer.search.pageInfo.hasNextPage || answer.search.pageInfo.endCursor === null) {
      return { ...last, rows: [] }
    }
    after = answer.search.pageInfo.endCursor
  }

  return last
})

const REASON_OF = {
  completed: "COMPLETED",
  discarded: "NOT_PLANNED",
  duplicate: "DUPLICATE"
} as const

export const closeIssue = Effect.fn("closeIssue")(function* (
  token: string,
  id: string,
  as: "completed" | "discarded" | "duplicate",
  of?: string
) {
  yield* graphRead<unknown>(
    token,
    `mutation Close($input: CloseIssueInput!) { closeIssue(input: $input) { clientMutationId } }`,
    {
      input: {
        issueId: id,
        stateReason: REASON_OF[as],
        ...(as === "duplicate" && of !== undefined ? { duplicateIssueId: of } : {})
      }
    }
  )
})

export const openIssue = Effect.fn("openIssue")(function* (token: string, id: string) {
  yield* graphRead<unknown>(
    token,
    `mutation Reopen($input: ReopenIssueInput!) { reopenIssue(input: $input) { clientMutationId } }`,
    { input: { issueId: id } }
  )
})

export const commentOnIssue = Effect.fn("commentOnIssue")(function* (
  token: string,
  card: Card,
  body: string
) {
  const comment = yield* restWrite<{
    readonly node_id: string
    readonly body: string
    readonly body_html?: string
    readonly created_at: string
    readonly user: { readonly login: string; readonly type: string; readonly avatar_url: string | null } | null
  }>(token, `/repos/${card.owner}/${card.repo}/issues/${card.number}/comments`, { body })

  const remark: RemarkFacts = {
    id: comment.node_id,
    author: {
      login: comment.user?.login ?? "ghost",
      isAutomated: comment.user?.type === "Bot",
      faceUrl: comment.user?.avatar_url ?? null
    },
    body: comment.body,
    html: comment.body_html ?? "",
    createdAt: comment.created_at
  }
  return remark
})

export const raiseIssue = Effect.fn("raiseIssue")(function* (
  token: string,
  where: { readonly owner: string; readonly repo: string },
  draft: { readonly title: string; readonly body: string }
) {
  const opened = yield* restWrite<{ readonly number: number }>(
    token,
    `/repos/${where.owner}/${where.repo}/issues`,
    { title: draft.title, body: draft.body }
  )

  return { owner: where.owner, repo: where.repo, number: opened.number }
})
