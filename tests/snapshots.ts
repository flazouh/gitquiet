import { Option } from "effect"
import type {
  ChangedFile,
  Check,
  Commit,
  MergeState,
  Participant,
  PullRequestSnapshot,
  Remark,
  Review,
  ReviewThread,
  ThreadAnchor,
  ThreadComment
} from "../src/domain/PullRequest"

export const VIEWER = "viewer-person"
export const AUTHOR = "author-person"

export const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: Option.none()
})
export const bot = (login: string): Participant => ({
  login,
  isAutomated: true,
  faceUrl: Option.none()
})

export const aComment = (
  author: Participant,
  body = "a remark",
  /**
   * The number their routes address a reply to. Present by default, because it is present on
   * everything read back from GitHub; pass undefined for the one case it is not, which is a
   * comment this interface wrote a moment ago and has not read again.
   */
  id: string | undefined = "1001"
): ThreadComment => ({
  id,
  author,
  body,
  html: `<p>${body}</p>`,
  createdAt: "2026-07-25T00:00:00Z"
})

export const aThread = (
  id: string,
  comments: ReadonlyArray<ThreadComment>,
  isResolved = false,
  at: Option.Option<ThreadAnchor> = Option.none()
): ReviewThread => ({ id, isResolved, at, comments })

export const aRemark = (id: string, author: Participant, body = "a remark"): Remark => ({
  id,
  author,
  body,
  html: `<p>${body}</p>`,
  createdAt: "2026-07-25T00:00:00Z"
})

/** A thread hung off one line of a file, for the diff to draw it beside. */
export const anchoredAt = (path: string, line: number): Option.Option<ThreadAnchor> =>
  Option.some({ path, side: "after", line, startLine: line })

export const aFile = (path: string, readByViewer = false): ChangedFile => ({
  path,
  digest: `digest-${path}`,
  changeType: "modified",
  linesAdded: 3,
  linesDeleted: 1,
  readByViewer,
  diff: Option.none()
})

export const aCommit = (sha: string, headline = `what ${sha} did`): Commit => ({
  sha,
  abbreviatedSha: sha.slice(0, 7),
  author: AUTHOR,
  headline,
  createdAt: "2026-08-04T00:00:00Z"
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

const NOTHING_IN_THE_WAY: MergeState = {
  isMergeable: true,
  blockers: [],
  queue: Option.none(),
  autoMerge: Option.none(),
  mayBypass: false,
  update: Option.none(),
  channels: [],
  stack: Option.none(),
  // The commonest of the three, so a test that is not about the way in reads as
  // the repositories most tests are written against. A merge state naming none
  // is a merge nobody may press — see `whatCanBeDone` — which is a fact worth
  // one test of its own rather than the default every other test inherits.
  method: Option.some("SQUASH")
}

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
  description: { markdown: "It spins now.", html: "<p>It spins now.</p>" },
  state: "open",
  openedAt: Option.none(),
  closedAt: Option.none(),
  mergedAt: Option.none(),
  author: person(AUTHOR),
  baseBranch: "main",
  headBranch: "spin",
  // Nothing to do with the branch, since an open pull request is still using
  // it. A test about the branch says so by passing its own.
  headRef: { mayDelete: false, mayRestore: false },
  proposal: Option.none(),
  headSha: "headsha",
  baseSha: "basesha",
  viewer: { login: VIEWER, lastReviewPoint: Option.none() },
  files: [],
  commits: [],
  threads: [],
  remarks: [],
  checks: [],
  reviews: Option.some([]),
  merge: Option.some(NOTHING_IN_THE_WAY),
  ...parts
})

/**
 * The merge box a test gets unless it says otherwise: answered, and answering yes.
 *
 * Exported because a test that wants one fact of it changed has to rebuild the whole
 * state around that fact, and `aSnapshot().merge` is an Option it would have to unwrap
 * first. `aMergeState({ update: ... })` is the same edit in one line.
 */
export const aMergeState = (parts: Partial<MergeState> = {}): Option.Option<MergeState> =>
  Option.some({ ...NOTHING_IN_THE_WAY, ...parts })

export const asAuthor = (parts: Partial<PullRequestSnapshot> = {}): PullRequestSnapshot =>
  aSnapshot({ ...parts, viewer: { login: AUTHOR, lastReviewPoint: Option.none() } })
