import { Option } from "effect"
import type { Listed } from "@/app/repoList"
import type { Branches } from "@/domain/sittings"
import { sittingsIn } from "@/domain/sittings"
import type { CheckRollup, InvolvedPullRequest, Opinion, Shelf } from "@/domain/workingSet"
import { RepoPullsScreen } from "@/ui/RepoPullsScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf } from "./faces"
import { hoursAgo, minutesAgo } from "./when"

/**
 * One repository's open pull requests, with a real stack standing in them.
 *
 * `vercel/next.js`, which had 2,136 open when this was read. That number is the whole
 * reason this screen exists beside the Working Set: a page holds twenty-five, so the
 * first page of something enormous and the whole of something small are the same
 * picture without it.
 *
 * The seven `mvenn/gc-*` rows are one stack and are not arranged into one here.
 * Each of them is really based on the one below it — `gc-02-tombstone-plumbing` on
 * `gc-015-valued-tombstones`, and so on up — and the branches are given to the same
 * folding the extension uses, so the nesting in the photograph is the nesting GitHub's
 * own refs describe. Their list draws those seven as seven unrelated rows, which is
 * what makes them worth photographing.
 */

const REPO = { owner: "vercel", repo: "next.js" }

const person = (login: string) => ({ login, isAutomated: false, faceUrl: faceOf(login) })

type Row = {
  readonly number: number
  readonly title: string
  readonly author: string
  /** Draft where GitHub says so. Everything here is open, since the list asked for open. */
  readonly draft?: boolean
  /**
   * Which of GitHub's shelves this arrived on, where it arrived on one.
   *
   * Absent on most of them, and the absence is the fact this screen turns on: a
   * repository's list is a plain query for every open pull request, and GitHub shelves
   * only the ones it considers the reader's. So the rows with nothing here are the ones
   * nobody has asked the reader for, and they sit in the Waiting Court rather than in a
   * list of things to go and do.
   */
  readonly shelf?: Shelf
  readonly added: number
  readonly deleted: number
  /** The rollup as GitHub counts it, skipped jobs included in the total. */
  readonly checks: CheckRollup
  readonly reviewed?: Opinion
  readonly comments: number
  readonly read?: boolean
  /** Hours before the capture, so the ages hold whenever the shutter opens. */
  readonly openedHoursAgo: number
  readonly changedMinutesAgo: number
  readonly headSha: string
  readonly baseBranch: string
  readonly headBranch: string
}

const ROWS: ReadonlyArray<Row> = [
  {
    number: 96949,
    title: "Allow suppressing TypeScript plugin diagnostics",
    author: "g-neff",
    shelf: "team-review-requested",
    added: 130,
    deleted: 1,
    checks: { state: "passing", total: 100, passed: 83 },
    reviewed: "review-required",
    comments: 2,
    read: false,
    openedHoursAgo: 4,
    changedMinutesAgo: 236,
    headSha: "7c71ad4a",
    baseBranch: "canary",
    headBranch: "jstahl/allow-ts-ignore"
  },
  {
    number: 96919,
    title: "[ci] Use OIDC tokens to read private preview builds",
    author: "e-simpson",
    shelf: "team-review-requested",
    added: 116,
    deleted: 23,
    checks: { state: "passing", total: 100, passed: 83 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 12,
    changedMinutesAgo: 587,
    headSha: "665599b0",
    baseBranch: "canary",
    headBranch: "s-almeida/mirror-oidc-read-token"
  },
  {
    number: 96929,
    title: "turbo-persistence: add key-value tombstones for MultiValue families",
    author: "l-sandberg",
    draft: true,
    added: 647,
    deleted: 77,
    checks: { state: "failing", total: 186, passed: 114 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 11,
    changedMinutesAgo: 355,
    headSha: "187f9dd5",
    baseBranch: "mvenn/gc-01-scope-self-feeding",
    headBranch: "mvenn/gc-015-valued-tombstones"
  },
  {
    number: 95975,
    title: "turbo-tasks-backend: add persistence delete/tombstone plumbing for GC",
    author: "l-sandberg",
    added: 448,
    deleted: 41,
    checks: { state: "failing", total: 130, passed: 39 },
    reviewed: "approved",
    comments: 3,
    openedHoursAgo: 441,
    changedMinutesAgo: 359,
    headSha: "943312a2",
    baseBranch: "mvenn/gc-015-valued-tombstones",
    headBranch: "mvenn/gc-02-tombstone-plumbing"
  },
  {
    number: 96043,
    title: "turbo-tasks-backend: Enforce that tasks exist when accessing them",
    author: "l-sandberg",
    added: 385,
    deleted: 93,
    checks: { state: "failing", total: 130, passed: 36 },
    reviewed: "approved",
    comments: 3,
    openedHoursAgo: 406,
    changedMinutesAgo: 361,
    headSha: "0126bc4a",
    baseBranch: "mvenn/gc-02-tombstone-plumbing",
    headBranch: "mvenn/gc-025-task-access"
  },
  {
    number: 95976,
    title: "turbo-tasks-backend: parent_count reference counting + garbage collection",
    author: "l-sandberg",
    added: 3512,
    deleted: 375,
    checks: { state: "failing", total: 130, passed: 36 },
    reviewed: "review-required",
    comments: 4,
    openedHoursAgo: 441,
    changedMinutesAgo: 355,
    headSha: "9e968534",
    baseBranch: "mvenn/gc-025-task-access",
    headBranch: "mvenn/gc-03-parent-count-collection"
  },
  {
    number: 95977,
    title: "turbo-tasks-backend: anchor GC roots, gate on Data residency, wire up the app",
    author: "l-sandberg",
    draft: true,
    added: 249,
    deleted: 62,
    checks: { state: "failing", total: 128, passed: 35 },
    reviewed: "review-required",
    comments: 3,
    openedHoursAgo: 441,
    changedMinutesAgo: 360,
    headSha: "c2494dca",
    baseBranch: "mvenn/gc-03-parent-count-collection",
    headBranch: "mvenn/gc-04-roots-gates-integration"
  },
  {
    number: 96857,
    title: "turbo-tasks: explicit GC root anchoring + cross-session orphan reclamation",
    author: "l-sandberg",
    draft: true,
    added: 1730,
    deleted: 203,
    checks: { state: "failing", total: 186, passed: 113 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 32,
    changedMinutesAgo: 349,
    headSha: "e0a6ed19",
    baseBranch: "mvenn/gc-04-roots-gates-integration",
    headBranch: "mvenn/gc-05-roots-orphans"
  },
  {
    number: 96676,
    title: "turbo-tasks-backend: let a GC pass wind down when it is blocking an operation",
    author: "l-sandberg",
    draft: true,
    added: 645,
    deleted: 3,
    checks: { state: "failing", total: 186, passed: 107 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 78,
    changedMinutesAgo: 357,
    headSha: "d240c924",
    baseBranch: "mvenn/gc-05-roots-orphans",
    headBranch: "mvenn/gc-05-interruptible"
  },
  {
    number: 96936,
    title: "[refactor] Rename `encodeCacheTag` to `encodeHeaderSafe`",
    author: "u-stubbs",
    added: 25,
    deleted: 23,
    checks: { state: "passing", total: 100, passed: 83 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 10,
    changedMinutesAgo: 512,
    headSha: "bc93082c",
    baseBranch: "canary",
    headBranch: "linnea-h/encode-header-safe"
  },
  {
    number: 96937,
    title: "Encode the cache item name built by `unstable_cache`",
    author: "u-stubbs",
    added: 253,
    deleted: 1,
    checks: { state: "passing", total: 100, passed: 83 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 10,
    changedMinutesAgo: 366,
    headSha: "40c7eca6",
    baseBranch: "linnea-h/encode-header-safe",
    headBranch: "linnea-h/encode-fetch-url"
  },
  {
    number: 96927,
    title: "Complete App Router render observability",
    author: "d-ilie",
    added: 2573,
    deleted: 297,
    checks: { state: "failing", total: 100, passed: 72 },
    reviewed: "review-required",
    comments: 2,
    read: false,
    openedHoursAgo: 11,
    changedMinutesAgo: 564,
    headSha: "2cc47b6c",
    baseBranch: "codex/request-insights-client-loading-c0",
    headBranch: "codex/request-insights-render-observability-v3"
  },
  {
    number: 96920,
    title: "Turbopack: implement Eq, Decode, Encode for ConstantValue",
    author: "m-schin",
    added: 70,
    deleted: 6,
    checks: { state: "failing", total: 100, passed: 91 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 12,
    changedMinutesAgo: 646,
    headSha: "faff9d19",
    baseBranch: "canary",
    headBranch: "constant-value-trait-impls"
  },
  {
    number: 96947,
    title: "Allow issue participants to request reopening",
    author: "m-hernan",
    draft: true,
    added: 267,
    deleted: 3,
    checks: { state: "passing", total: 100, passed: 83 },
    reviewed: "review-required",
    comments: 2,
    openedHoursAgo: 5,
    changedMinutesAgo: 251,
    headSha: "9011aa7a",
    baseBranch: "canary",
    headBranch: "codex/issue-participant-reopen"
  }
]

const involvedFrom = (row: Row): InvolvedPullRequest => ({
  reference: { owner: REPO.owner, repo: REPO.repo, number: row.number },
  /*
   * GitHub's own numeric id is what the deferred reads answer by, and this stage has no
   * deferred read. The number is used instead because it is the one thing about a row
   * that is certainly unique in one repository, and nothing on the screen draws it.
   */
  id: row.number,
  title: row.title,
  author: person(row.author),
  state: row.draft === true ? "draft" : "open",
  shelf: Option.fromNullishOr(row.shelf),
  why: Option.none(),
  readByViewer: row.read ?? true,
  comments: row.comments,
  labels: 0,
  assignees: 0,
  openedAt: hoursAgo(row.openedHoursAgo),
  changedAt: minutesAgo(row.changedMinutesAgo),
  headSha: row.headSha,
  channels: [],
  checks: Option.some(row.checks),
  reviewed: Option.fromNullishOr(row.reviewed),
  size: Option.some({ added: row.added, deleted: row.deleted })
})

const branchesOf = (one: InvolvedPullRequest): Option.Option<Branches> => {
  const row = ROWS.find((candidate) => candidate.number === one.reference.number)
  if (row === undefined) return Option.none()
  return Option.some({ baseBranch: row.baseBranch, headBranch: row.headBranch })
}

export const LIST: Listed = {
  sittings: sittingsIn(ROWS.map(involvedFrom), branchesOf),
  /*
   * Where this page sits in the whole list, which their own pager says.
   *
   * 2,136 open pull requests at twenty-five to a page is eighty-six pages. Counting the
   * rows instead would print "14 pull requests" under a bar that says `vercel/next.js`,
   * which is the most misleading true thing this screen could say.
   */
  pages: Option.some({ current: 1, total: 86, count: 2136 })
}

export const REPO_PULLS_VIEW: View = {
  name: "repo-pulls",
  caption:
    "One repository's pull requests, filed by whose move it is, with a seven-deep stack folded into one row",
  ...STORE,
  draw: () => (
    <RepoPullsScreen
      repo={REPO}
      load={settled(LIST)}
      preload={alreadyKnown(LIST)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onOpen={() => {}}
      onPage={() => {}}
      onStepAside={() => {}}
    />
  )
}
