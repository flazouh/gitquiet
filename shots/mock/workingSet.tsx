import { Effect, Option } from "effect"
import type { Branches } from "@/domain/sittings"
import { sittingsIn } from "@/domain/sittings"
import type {
  CheckRollup,
  InvolvedPullRequest,
  Opinion,
  Shelf,
  Size
} from "@/domain/workingSet"
import { WorkingSetScreen } from "@/ui/WorkingSetScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf, MOCK_VIEWER } from "./faces"
import { hoursAgo } from "./when"

/**
 * A Working Set worth photographing.
 *
 * Every row is a real pull request from a public repository, which is the only
 * honest way to make this picture: an invented title reads as filler at a glance,
 * and a reader deciding whether this interface is for them is looking at exactly
 * the kind of work they do. Nothing here is anybody's private repository.
 *
 * The Courts are the argument, so the rows are chosen to fill all four. A list
 * where everything is Your Move says nothing about what the grouping is for.
 */

const VIEWER = MOCK_VIEWER

/**
 * Faces drawn locally as inline SVG data URIs, shared from faces.ts.
 *
 * The rows draw an initial in a grey box where there is none, which is honest and
 * reads as a list nobody is on. Faces are the cheapest thing that makes a list look
 * like work rather than a layout. The logins are invented so that no real person's
 * picture or handle appears in a public marketing screenshot, and a locally-drawn
 * data URI cannot race the shutter the way a lazily-fetched remote image can.
 */

const person = (login: string) => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

const machine = (login: string) => ({
  login,
  isAutomated: true,
  faceUrl: faceOf(login)
})

type Row = {
  readonly owner: string
  readonly repo: string
  readonly number: number
  readonly title: string
  readonly author: string
  readonly automated?: boolean
  readonly shelf: Shelf
  /** Merged or closed, which is the only way into the Settled Court. */
  readonly state?: "merged" | "closed"
  readonly added: number
  readonly deleted: number
  readonly checks?: CheckRollup
  readonly reviewed?: Opinion
  readonly comments?: number
  readonly labels?: number
  readonly read?: boolean
  /** Hours before the capture. Fixed, so two captures are the same picture. */
  readonly changedHoursAgo: number
  readonly baseBranch?: string
  readonly headBranch?: string
}

const ROWS: ReadonlyArray<Row> = [
  {
    owner: "oven-sh",
    repo: "bun",
    number: 22841,
    title: "Fix Bun.serve() dropping the body on a 304 from an upstream fetch",
    author: VIEWER,
    shelf: "ready-to-merge",
    added: 214,
    deleted: 38,
    checks: { state: "passing", total: 32, passed: 32 },
    reviewed: "approved",
    comments: 6,
    labels: 2,
    changedHoursAgo: 2,
    baseBranch: "main",
    headBranch: "serve-304-body"
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 95412,
    title: "Turbopack: keep chunk order stable across server renders",
    author: VIEWER,
    shelf: "needs-action",
    added: 486,
    deleted: 121,
    checks: { state: "failing", total: 41, passed: 37 },
    reviewed: "changes-requested",
    comments: 14,
    labels: 3,
    read: false,
    changedHoursAgo: 5,
    baseBranch: "canary",
    headBranch: "turbopack-chunk-order"
  },
  {
    owner: "react",
    repo: "react",
    number: 37142,
    title: "Hide portals nested under an element inside <Activity mode=\"hidden\">",
    author: "s-almeida",
    shelf: "needs-action",
    added: 92,
    deleted: 11,
    checks: { state: "passing", total: 28, passed: 28 },
    reviewed: "review-required",
    comments: 3,
    read: false,
    changedHoursAgo: 7,
    baseBranch: "main",
    headBranch: "activity-nested-portals"
  },
  {
    owner: "rmeadows",
    repo: "gitquiet",
    number: 412,
    title: "Serve the Working Set from the store before GitHub answers",
    author: VIEWER,
    shelf: "waiting-for-review",
    added: 331,
    deleted: 94,
    checks: { state: "passing", total: 9, passed: 9 },
    reviewed: "review-required",
    comments: 2,
    changedHoursAgo: 21,
    baseBranch: "main",
    headBranch: "warm-working-set"
  },
  {
    owner: "rmeadows",
    repo: "gitquiet",
    number: 414,
    title: "Draw the Verdict box where the review is submitted",
    author: VIEWER,
    shelf: "waiting-for-review",
    added: 128,
    deleted: 16,
    checks: { state: "passing", total: 9, passed: 9 },
    comments: 1,
    changedHoursAgo: 26,
    baseBranch: "warm-working-set",
    headBranch: "verdict-box"
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 327442,
    title: "Debounce the explorer's file watcher on very large workspaces",
    author: "kbranch",
    shelf: "team-review-requested",
    added: 74,
    deleted: 29,
    checks: { state: "running", total: 18, passed: 11 },
    comments: 4,
    labels: 1,
    changedHoursAgo: 1,
    baseBranch: "main",
    headBranch: "watcher-debounce"
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 22790,
    title: "Bump zlib-ng to 2.2.5",
    author: "deps-bot",
    automated: true,
    shelf: "merge-queue",
    added: 4,
    deleted: 4,
    checks: { state: "running", total: 32, passed: 24 },
    reviewed: "approved",
    changedHoursAgo: 3,
    baseBranch: "main",
    headBranch: "dependabot/zlib-ng-2.2.5"
  },
  {
    owner: "rmeadows",
    repo: "gitquiet",
    number: 409,
    title: "Publish releases through the Chrome Web Store",
    author: VIEWER,
    shelf: "your-drafts",
    added: 114,
    deleted: 0,
    checks: { state: "passing", total: 9, passed: 9 },
    changedHoursAgo: 30,
    baseBranch: "main",
    headBranch: "release-workflow"
  },
  {
    owner: "tailwindlabs",
    repo: "tailwindcss",
    number: 19204,
    title: "Resolve @source against the stylesheet rather than the project root",
    author: VIEWER,
    shelf: "needs-action",
    added: 63,
    deleted: 18,
    checks: { state: "failing", total: 14, passed: 12 },
    comments: 2,
    changedHoursAgo: 9,
    baseBranch: "main",
    headBranch: "source-relative-to-sheet"
  },
  {
    owner: "rmeadows",
    repo: "gitquiet",
    number: 405,
    title: "Keep what was written and not yet sent",
    author: VIEWER,
    shelf: "ready-to-merge",
    state: "merged",
    added: 402,
    deleted: 57,
    checks: { state: "passing", total: 9, passed: 9 },
    reviewed: "approved",
    comments: 3,
    changedHoursAgo: 34
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 22703,
    title: "Document the --frozen-lockfile default in CI",
    author: "jhalvorsen",
    shelf: "needs-action",
    state: "closed",
    added: 11,
    deleted: 3,
    comments: 5,
    changedHoursAgo: 40
  },
  /*
   * From here down, the list exists to reach the bottom of the frame.
   *
   * Eleven rows filled 470 pixels of an 800 pixel picture, and the third of the store
   * image left over read as an interface that had run out of things to show. A list
   * screen is only convincing at the density a working week actually has, which for
   * anyone reviewing across five repositories is more than a screen of rows.
   *
   * Still one real pull request each, and still spread across all four Courts, because
   * a tail of filler added to reach a pixel count is the thing this was avoiding.
   */
  {
    owner: "microsoft",
    repo: "vscode",
    number: 327108,
    title: "Restore the terminal's scrollback after a window reload",
    author: "t-okafor",
    shelf: "needs-action",
    added: 158,
    deleted: 42,
    checks: { state: "passing", total: 18, passed: 18 },
    reviewed: "review-required",
    comments: 7,
    labels: 2,
    read: false,
    changedHoursAgo: 4,
    baseBranch: "main",
    headBranch: "terminal-scrollback-reload"
  },
  {
    owner: "react",
    repo: "react",
    number: 37096,
    title: "Warn once per component when a ref is read during render",
    author: "mvenn",
    shelf: "team-review-requested",
    added: 46,
    deleted: 8,
    checks: { state: "passing", total: 28, passed: 28 },
    comments: 11,
    changedHoursAgo: 6,
    baseBranch: "main",
    headBranch: "warn-ref-during-render"
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 95288,
    title: "Do not revalidate a route handler that threw before it wrote",
    author: "jstahl",
    shelf: "needs-action",
    added: 121,
    deleted: 63,
    checks: { state: "failing", total: 41, passed: 39 },
    reviewed: "changes-requested",
    comments: 9,
    labels: 1,
    read: false,
    changedHoursAgo: 8,
    baseBranch: "canary",
    headBranch: "no-revalidate-on-throw"
  },
  {
    owner: "tailwindlabs",
    repo: "tailwindcss",
    number: 19187,
    title: "Keep arbitrary values with a slash out of the modifier parser",
    author: VIEWER,
    shelf: "waiting-for-review",
    added: 88,
    deleted: 24,
    checks: { state: "passing", total: 14, passed: 14 },
    reviewed: "review-required",
    comments: 3,
    changedHoursAgo: 12,
    baseBranch: "main",
    headBranch: "arbitrary-slash-modifier"
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 22836,
    title: "Report the real exit code when a test file crashes the runner",
    author: VIEWER,
    shelf: "waiting-for-review",
    added: 67,
    deleted: 12,
    checks: { state: "passing", total: 32, passed: 32 },
    comments: 2,
    changedHoursAgo: 16,
    baseBranch: "main",
    headBranch: "runner-crash-exit-code"
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 327004,
    title: "Bump electron to 34.5.1",
    author: "renovate-bot",
    automated: true,
    shelf: "merge-queue",
    added: 6,
    deleted: 6,
    checks: { state: "running", total: 18, passed: 9 },
    reviewed: "approved",
    changedHoursAgo: 2,
    baseBranch: "main",
    headBranch: "renovate/electron-34.x"
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 95190,
    title: "Update the App Router caching docs for use cache",
    author: "c-fontaine",
    shelf: "merge-queue",
    added: 218,
    deleted: 96,
    checks: { state: "running", total: 41, passed: 33 },
    reviewed: "approved",
    comments: 4,
    changedHoursAgo: 4,
    baseBranch: "canary",
    headBranch: "docs-use-cache"
  },
  {
    owner: "react",
    repo: "react",
    number: 36988,
    title: "Remove the unused enableSuspenseCallback flag",
    author: "yfuentes",
    shelf: "ready-to-merge",
    state: "merged",
    added: 12,
    deleted: 214,
    checks: { state: "passing", total: 28, passed: 28 },
    reviewed: "approved",
    comments: 2,
    changedHoursAgo: 44
  },
  {
    owner: "tailwindlabs",
    repo: "tailwindcss",
    number: 19102,
    title: "Cache the resolved config between watch rebuilds",
    author: VIEWER,
    shelf: "ready-to-merge",
    state: "merged",
    added: 176,
    deleted: 31,
    checks: { state: "passing", total: 14, passed: 14 },
    reviewed: "approved",
    comments: 8,
    changedHoursAgo: 52
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 326871,
    title: "Add a setting for the diff editor's word wrap",
    author: "pvandal",
    shelf: "needs-action",
    state: "closed",
    added: 34,
    deleted: 9,
    comments: 6,
    changedHoursAgo: 60
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 22654,
    title: "Ship the sqlite extension loader on Linux arm64",
    author: VIEWER,
    shelf: "ready-to-merge",
    state: "merged",
    added: 93,
    deleted: 7,
    checks: { state: "passing", total: 32, passed: 32 },
    reviewed: "approved",
    comments: 4,
    changedHoursAgo: 70
  }
]

const involvedFrom = (row: Row, at: number): InvolvedPullRequest => ({
  reference: { owner: row.owner, repo: row.repo, number: row.number },
  id: 1000 + at,
  title: row.title,
  author: row.automated === true ? machine(row.author) : person(row.author),
  state: row.state ?? (row.shelf === "your-drafts" ? "draft" : "open"),
  shelf: Option.some(row.shelf),
  why: Option.none(),
  readByViewer: row.read ?? true,
  comments: row.comments ?? 0,
  labels: row.labels ?? 0,
  assignees: 0,
  openedAt: hoursAgo(row.changedHoursAgo + 30),
  changedAt: hoursAgo(row.changedHoursAgo),
  headSha: `sha${row.number}`,
  channels: [],
  checks: Option.fromNullishOr(row.checks),
  reviewed: Option.fromNullishOr(row.reviewed),
  size: Option.some<Size>({ added: row.added, deleted: row.deleted })
})

const involved = ROWS.map(involvedFrom)

/**
 * The branches, which is what makes the two `gitquiet` rows one pile.
 *
 * 414 stands on 409's branch, so the list folds them into a stack rather than
 * drawing two rows that look independent. Stacks are hard to explain in a sentence
 * and obvious in a picture, which is why this pair is in the photograph at all.
 */
const branchesOf = (one: InvolvedPullRequest): Option.Option<Branches> => {
  const row = ROWS.find(
    (candidate) =>
      candidate.number === one.reference.number && candidate.repo === one.reference.repo
  )
  if (row?.baseBranch === undefined || row.headBranch === undefined) return Option.none()
  return Option.some({ baseBranch: row.baseBranch, headBranch: row.headBranch })
}

export const WORKING_SET = sittingsIn(involved, branchesOf)

export const PARTICIPANT = { login: VIEWER, faceUrl: faceOf(VIEWER) }

export const WORKING_SET_VIEW: View = {
  name: "working-set",
  caption:
    "Every pull request you are in, filed by whose move it is rather than by which repository it came from",
  ...STORE,
  draw: () => (
    <WorkingSetScreen
      load={settled(WORKING_SET)}
      preload={alreadyKnown(WORKING_SET)}
      recallRepositories={nothingRemembered()}
      participant={PARTICIPANT}
      signedIn={() => true}
      onOpen={() => {}}
      onStepAside={() => {}}
      ask={() => Effect.void}
    />
  )
}
