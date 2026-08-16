import { Option } from "effect"
import type { ListedIssues } from "../../src/app/issueList"
import type { ListedIssue } from "../../src/domain/issues"
import type { Participant } from "../../src/domain/PullRequest"
import { IssueListScreen } from "../../src/ui/IssueListScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf } from "./faces"
import { hoursAgo } from "./when"

/**
 * One repository's issues, and it is somebody's real repository.
 *
 * `oven-sh/bun`, whose open issues run into the thousands, because that is the list
 * this screen was written for. A repository with nine issues needs no filter, no
 * count and no second page, so photographing one would be photographing the easy
 * case and none of the instruments.
 *
 * Every row is a real open issue, taken as the list comes back: newest first, titles
 * as they were written, and the counts and labels the repository actually carries. An
 * invented title reads as filler at a glance, and this picture is what somebody
 * decides on.
 */

/**
 * Faces drawn locally as inline SVG data URIs, shared from faces.ts.
 *
 * Twenty-five strangers down one edge of the list, which is what a busy repository's
 * issues are. The logins are invented so that no real person's picture or handle
 * appears in a public marketing screenshot, and a locally-drawn data URI cannot race
 * the shutter the way a lazily-fetched remote image can.
 */

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

const REPO = { owner: "oven-sh", repo: "bun" }

type Row = {
  readonly number: number
  readonly title: string
  readonly author: string
  /** The labels' own words, in the order GitHub gave them. */
  readonly labels?: ReadonlyArray<string>
  readonly comments?: number
  /** Hours before the capture. Fixed, so two captures are the same picture. */
  readonly raisedHoursAgo: number
}

/**
 * A page of them, newest first, which is the order this search answers in.
 *
 * Twenty-five rather than the ten a smaller list would show, because twenty-five is
 * the page GitHub gives and a page cut off by the bottom of the frame is the honest
 * picture of one: there are three thousand more, and a list that ended tidily inside
 * the frame would say there were not.
 */
const ROWS: ReadonlyArray<Row> = [
  {
    number: 37161,
    title: "`// @bun` pragma makes non-ASCII string literals decode as latin-1 at runtime",
    author: "p-brennan",
    comments: 1,
    raisedHoursAgo: 1
  },
  {
    number: 37152,
    title:
      "When Typescript (`v7.0.2`) & `@typescript/typescript6` are both installed in a project, `bun tsc --version` prints `Version 6.0.3`",
    author: "r-west",
    labels: ["bug", "needs triage"],
    comments: 1,
    raisedHoursAgo: 6
  },
  {
    number: 37151,
    title: "Bun silently drops writes to [new Uint8Array(n)] under 1024 bytes",
    author: "c-santos",
    labels: ["bug", "needs triage"],
    comments: 2,
    raisedHoursAgo: 6
  },
  {
    number: 37144,
    title: "Native Bun queue manager with Redis + optional isolated workers",
    author: "l-ramos",
    labels: ["enhancement"],
    comments: 2,
    raisedHoursAgo: 8
  },
  {
    number: 37110,
    title:
      "undici shim lacks `ping()` export and `undici:websocket:ping`/`pong` diagnostics channels, breaking @slack/socket-mode (permanent reconnect loop)",
    author: "n-bach",
    comments: 1,
    raisedHoursAgo: 14
  },
  {
    number: 37086,
    title:
      "net.Socket#unref() called before connect() makes the process exit before the connection completes",
    author: "a-johansson",
    labels: ["bug", "needs triage"],
    comments: 1,
    raisedHoursAgo: 20
  },
  {
    number: 37060,
    title: "Test failure handler",
    author: "m-chen",
    labels: ["enhancement"],
    comments: 3,
    raisedHoursAgo: 33
  },
  {
    number: 37059,
    title:
      "Bun.Image: CMYK JPEG decode needs ICC-aware (lcms) conversion, not naive browser formula",
    author: "f-lunde",
    comments: 3,
    raisedHoursAgo: 34
  },
  {
    number: 37028,
    title: "unable to target specific version with overrides / resolutions",
    author: "j-bishop",
    labels: ["enhancement"],
    comments: 2,
    raisedHoursAgo: 40
  },
  {
    number: 36994,
    title: "bun -e: a top-level `const zlib = ...` loads node:zlib before the script body runs",
    author: "botrunner",
    comments: 1,
    raisedHoursAgo: 49
  },
  {
    number: 36984,
    title:
      "`fs.rm(path, { recursive: true, force: true })` rejects with `EFAULT` when concurrent calls race on the same directory",
    author: "g-tran",
    raisedHoursAgo: 53
  },
  {
    number: 36980,
    title:
      "`Bun.serve`  expose sourcemaps by default even when running in production mode. (development:false) option",
    author: "d-ferreira",
    labels: ["bug", "needs triage"],
    comments: 2,
    raisedHoursAgo: 53
  },
  {
    number: 36975,
    title:
      "🚀 Feature Request: Make `Bun.serve` production-safe by default and require explicit development opt-in",
    author: "d-ferreira",
    labels: ["enhancement"],
    comments: 4,
    raisedHoursAgo: 54
  },
  {
    number: 36967,
    title: "Support awaitable `.rejects` matchers for Jest/Vitest compatibility",
    author: "e-sommer",
    labels: ["enhancement"],
    raisedHoursAgo: 57
  },
  {
    number: 36964,
    title: "bun create normalizes template indentation to spaces, ignoring source formatting",
    author: "a-vaupot",
    comments: 1,
    raisedHoursAgo: 57
  },
  {
    number: 36957,
    title: '`node:fs`\'s watch only fires single "rename" event on file rename (MacOS)',
    author: "h-strand",
    labels: ["bug", "needs triage"],
    comments: 3,
    raisedHoursAgo: 60
  },
  {
    number: 36953,
    title: "bun create: git commit timing log interleaves with postinstall output",
    author: "a-vaupot",
    comments: 1,
    raisedHoursAgo: 60
  },
  {
    number: 36931,
    title: "git+ssh dependency with non-default SSH port fails to resolve",
    author: "f-crane",
    labels: ["bug", "needs triage"],
    comments: 1,
    raisedHoursAgo: 68
  },
  {
    number: 36925,
    title:
      "Bun.Image: Metal/IOGPU device pool grows in 128MB chunks with peak concurrency and never shrinks",
    author: "x-park",
    comments: 1,
    raisedHoursAgo: 70
  },
  {
    number: 36916,
    title: "ESLint errors missing under Bun but present under Node (size-dependent)",
    author: "l-bart",
    labels: ["bug", "needs triage"],
    comments: 3,
    raisedHoursAgo: 75
  },
  {
    number: 36908,
    title:
      "node:fs cpSync({ recursive: true }) emits a spurious source-directory rename event on macOS",
    author: "k-ender",
    comments: 1,
    raisedHoursAgo: 78
  },
  {
    number: 36866,
    title: "next build segfaults during page data collection with Next.js 16.3.0 (bun 1.3.14)",
    author: "l-duarte",
    comments: 5,
    raisedHoursAgo: 93
  },
  {
    number: 36830,
    title:
      "Bun.serve: accept dev-server bundling plugins programmatically (not only via bunfig [serve.static])",
    author: "t-dev",
    raisedHoursAgo: 104
  },
  {
    number: 36829,
    title: "Bun.Image: Add flatten/background compositing support for transparent images",
    author: "f-lunde",
    raisedHoursAgo: 105
  },
  {
    number: 36828,
    title:
      "NAPI promise never settles under `bun test` on 1.4 canary (works on 1.3.13, and works under `bun run`)",
    author: "n-verma",
    comments: 1,
    raisedHoursAgo: 105
  }
]

/**
 * One row, as the issue search answers it.
 *
 * The id is a key here and nothing else, since nothing on this stage is written and so
 * nothing is ever addressed by it. No row names its repository: they are all in the
 * one the bar above says, and the list leaves the name out for exactly that reason.
 */
const listedFrom = (row: Row): ListedIssue => ({
  reference: { ...REPO, number: row.number },
  id: `I_bun_${row.number}`,
  title: row.title,
  author: person(row.author),
  state: "open",
  comments: row.comments ?? 0,
  labels: row.labels ?? [],
  raisedAt: hoursAgo(row.raisedHoursAgo)
})

/**
 * Where this page sits, which is what makes the count worth drawing.
 *
 * Three thousand eight hundred and thirty-five open issues, twenty-five to a page, so
 * a hundred and fifty-four pages of them. The rows say what is here and the count says
 * what is not, and on a repository this size the second is the more useful of the two.
 */
const LISTED: ListedIssues = {
  rows: ROWS.map(listedFrom),
  pages: Option.some({ current: 1, total: 154, count: 3835 })
}

export const REPO_ISSUES_VIEW: View = {
  name: "repo-issues",
  caption:
    "One repository's issues with the filter above them, on a repository that has three thousand of them",
  ...STORE,
  draw: () => (
    <IssueListScreen
      repo={REPO}
      load={settled(LISTED)}
      preload={alreadyKnown(LISTED)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onPage={() => {}}
      onStepAside={() => {}}
    />
  )
}
