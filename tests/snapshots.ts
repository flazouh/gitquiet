import { Option } from "effect"
import type {
  ChangedFile,
  Check,
  Participant,
  PullRequestSnapshot,
  Review,
  ReviewThread,
  ThreadComment
} from "../src/domain/PullRequest"

export const VIEWER = "viewer-person"
export const AUTHOR = "author-person"

export const person = (login: string): Participant => ({ login, isAutomated: false })
export const bot = (login: string): Participant => ({ login, isAutomated: true })

export const aComment = (author: Participant, body = "a remark"): ThreadComment => ({
  author,
  body,
  createdAt: "2026-07-25T00:00:00Z"
})

export const aThread = (
  id: string,
  comments: ReadonlyArray<ThreadComment>,
  isResolved = false
): ReviewThread => ({ id, isResolved, comments })

export const aFile = (path: string, readByViewer = false): ChangedFile => ({
  path,
  digest: `digest-${path}`,
  changeType: "modified",
  linesAdded: 3,
  linesDeleted: 1,
  readByViewer,
  diff: Option.none()
})

export const aCheck = (name: string, state: Check["state"]): Check => ({
  name,
  state,
  isRequired: true,
  summary: `${name} says something`,
  url: `/checks/${name}`,
  durationSeconds: 10
})

export const aReview = (login: string, decision: Review["decision"]): Review => ({
  reviewer: person(login),
  decision
})

/**
 * A snapshot with nothing on it, so each test adds only what it is about.
 * The viewer is a Reviewer by default; pass `viewer: { login: AUTHOR, … }` to
 * look at the same pull request as its Author.
 */
export const aSnapshot = (
  parts: Partial<PullRequestSnapshot> = {}
): PullRequestSnapshot => ({
  reference: { owner: "acme", repo: "widgets", number: 7 },
  title: "Make the widget spin",
  state: "open",
  author: person(AUTHOR),
  baseBranch: "main",
  headBranch: "spin",
  headSha: "headsha",
  viewer: { login: VIEWER, lastReviewPoint: Option.none() },
  files: [],
  commits: [],
  threads: [],
  checks: [],
  reviews: [],
  merge: { isMergeable: true, blockers: [] },
  ...parts
})

export const asAuthor = (parts: Partial<PullRequestSnapshot> = {}): PullRequestSnapshot =>
  aSnapshot({ ...parts, viewer: { login: AUTHOR, lastReviewPoint: Option.none() } })
