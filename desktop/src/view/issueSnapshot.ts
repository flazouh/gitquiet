import { Option } from "effect"
import type { IssueSnapshot } from "../../../src/domain/Issue"
import type { InvolvedIssue, Involvement, ListedIssue } from "../../../src/domain/issues"
import type { Repository } from "../../../src/domain/repositories"
import type { FoundIssues } from "../../../src/ports/GitHubGateway"
import type { FaceFacts, FoundIssueFacts, IssueFacts, ListedIssueFacts, RepositoryFacts } from "../shared/wire"

const faceOf = (face: FaceFacts) => ({
  login: face.login,
  isAutomated: face.isAutomated,
  faceUrl: Option.fromNullishOr(face.faceUrl)
})

export const issueFrom = (facts: IssueFacts): IssueSnapshot => ({
  reference: { owner: facts.owner, repo: facts.repo, number: facts.number },
  id: facts.id,
  title: facts.title,
  description: { markdown: facts.markdown, html: facts.html },
  state: facts.state,
  closing: Option.fromNullishOr(facts.closing),
  openedAt: facts.openedAt,
  author: faceOf(facts.author),
  labels: facts.labels.map((one) => ({
    name: one.name,
    colour: one.colour,
    description: Option.fromNullishOr(one.description)
  })),
  assignees: facts.assignees.map(faceOf),
  remarks: facts.remarks.map((one) => ({
    id: one.id,
    author: faceOf(one.author),
    body: one.body,
    html: one.html,
    createdAt: one.createdAt
  })),
  reactions: facts.reactions,
  allowed: facts.allowed,
  viewer: Option.fromNullishOr(facts.viewer === null ? undefined : faceOf(facts.viewer))
})

export const listedFrom = (facts: ListedIssueFacts): ListedIssue => ({
  reference: { owner: facts.owner, repo: facts.repo, number: facts.number },
  id: facts.id,
  title: facts.title,
  author: faceOf(facts.author),
  state: facts.state,
  comments: facts.comments,
  labels: facts.labels,
  raisedAt: facts.raisedAt
})

export const involvedFrom = (involvement: Involvement, facts: ListedIssueFacts): InvolvedIssue => ({
  ...listedFrom(facts),
  involvement
})

export const foundFrom = (facts: FoundIssueFacts): FoundIssues => ({
  rows: facts.rows.map(listedFrom),
  pages: Option.some({ current: facts.current, total: facts.total, count: facts.count })
})

export const repositoryFrom = (facts: RepositoryFacts): Repository => ({
  owner: facts.owner,
  repo: facts.repo,
  nameWithOwner: facts.nameWithOwner,
  faceUrl: Option.fromNullishOr(facts.faceUrl),
  ofAnOrganisation: facts.ofAnOrganisation,
  isPrivate: facts.isPrivate,
  isEmpty: facts.isEmpty
})
