import { Option } from "effect"
import type { ListedIssues } from "../../src/app/issueList"
import type { ListedIssue } from "../../src/domain/issues"
import type { Participant } from "../../src/domain/PullRequest"
import { IssuesScreen } from "../../src/ui/IssuesScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf } from "./faces"
import { hoursAgo } from "./when"

/**
 * The issues owed to the reader, from everywhere at once.
 *
 * Every row is a real open issue in a public repository, which is the only honest way
 * to make this picture: an invented title reads as filler at a glance, and a reader
 * deciding whether this interface is for them is looking at the kind of work they do.
 * Nothing here is anybody's private repository.
 *
 * The Assigned tab, of GitHub's three, because it is the one that answers the question
 * this screen exists for. Assigned is the reader having been given the thing, and a
 * list of what somebody has been given is a list they have to do something about.
 *
 * Four repositories rather than one, and the rows say which they came from. That is
 * the whole difference from a repository's own list next door: the reader's work is
 * spread across other people's repositories, and the repository is the first thing
 * worth knowing about each row rather than the one thing every row shares.
 */

/**
 * Faces drawn locally as inline SVG data URIs, shared from faces.ts.
 *
 * The rows draw an initial in a grey box where there is none, which is honest and
 * reads as a list nobody is on. Faces are the cheapest thing that makes a list look
 * like work rather than a layout. The logins are invented so that no real person's
 * picture or handle appears in a public marketing screenshot.
 */

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

type Row = {
  readonly owner: string
  readonly repo: string
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
 * Newest first, which is the order this search comes back in.
 *
 * Twenty-two rows because that is what the frame holds without the last one being cut
 * in half. A list of six over four hundred pixels of nothing would be a photograph of
 * an interface nobody uses.
 */
const ROWS: ReadonlyArray<Row> = [
  {
    owner: "microsoft",
    repo: "vscode",
    number: 329713,
    title: "Agent Host Copilot startup repeatedly fails when native runtime cannot load",
    author: "nvasquez",
    raisedHoursAgo: 1
  },
  {
    owner: "react",
    repo: "react",
    number: 37243,
    title:
      '[DevTools Bug] Cannot remove node "5060" because no matching node was found in the Store.',
    author: "a-kumar",
    labels: ["Type: Bug", "Status: Unconfirmed", "Component: Developer Tools"],
    raisedHoursAgo: 1
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 329709,
    title: "Drag Files from VS Code File Explorer to External Applications",
    author: "a-petit",
    labels: ["new release"],
    raisedHoursAgo: 1
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 329704,
    title: "Extra */ inserted on typing /** */",
    author: "m-karev",
    labels: ["new release"],
    raisedHoursAgo: 2
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 329702,
    title: "Voice backend: adopt Omni Chat route metadata for narration",
    author: "f-lepage",
    labels: ["feature-request", "voice-mode"],
    raisedHoursAgo: 2
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 37151,
    title: "Bun silently drops writes to [new Uint8Array(n)] under 1024 bytes",
    author: "c-santos",
    labels: ["bug", "needs triage"],
    comments: 2,
    raisedHoursAgo: 6
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96935,
    title: "Dynamic Pages API routes return 404 on Vercel when Pages Router i18n is enabled",
    author: "r-rosales",
    labels: ["Output", "Internationalization (i18n)", "Pages Router", "Dynamic Routes"],
    raisedHoursAgo: 6
  },
  {
    owner: "react",
    repo: "react",
    number: 37240,
    title: "Bug: False-positive missing key warning when Flight outlines a static child",
    author: "p-holmberg",
    labels: ["Status: Unconfirmed"],
    raisedHoursAgo: 9
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96897,
    title: "Turbopack 16.3.0 panics while tracing Takumi WASM route",
    author: "g-palomino",
    labels: ["Turbopack"],
    comments: 1,
    raisedHoursAgo: 11
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96893,
    title: "Optimistic routes wrongly predicts rewritten pages",
    author: "b-thuren",
    labels: ["Linking and Navigating"],
    raisedHoursAgo: 12
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 37110,
    title:
      "undici shim lacks `ping()` export and `undici:websocket:ping`/`pong` diagnostics channels, breaking @slack/socket-mode (permanent reconnect loop)",
    author: "n-bach",
    comments: 1,
    raisedHoursAgo: 14
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 37086,
    title:
      "net.Socket#unref() called before connect() makes the process exit before the connection completes",
    author: "a-johansson",
    labels: ["bug", "needs triage"],
    comments: 1,
    raisedHoursAgo: 20
  },
  {
    owner: "react",
    repo: "react",
    number: 37231,
    title:
      "[Compiler Bug]: React Compiler changes quoted computed property access to dot notation",
    author: "j-oberg",
    labels: ["Type: Bug", "Status: Unconfirmed"],
    raisedHoursAgo: 22
  },
  {
    owner: "react",
    repo: "react",
    number: 37228,
    title: "[Compiler Bug]: crashes with “Expected a node for all scopes”",
    author: "c-novotny",
    labels: ["Type: Bug", "Status: Unconfirmed"],
    raisedHoursAgo: 28
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96859,
    title:
      'Turbopack build fails on pages-router files named `sitemap`/`robots`: `"getStaticProps" is not supported in app/` (no app directory)',
    author: "r-arias",
    raisedHoursAgo: 28
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96855,
    title:
      "Scroll is not reset on navigation when a parallel route slot renders only a position: fixed element (appNewScrollHandler regression in 16.3.0)",
    author: "p-ilton",
    comments: 1,
    raisedHoursAgo: 29
  },
  {
    owner: "vercel",
    repo: "next.js",
    number: 96831,
    title:
      '16.3.0: Turbopack serializes moduleLoading.crossOrigin as string "none", adding unexpected crossorigin="" to chunk scripts (breaks cross-origin assetPrefix CDNs)',
    author: "b-qing",
    raisedHoursAgo: 32
  },
  {
    owner: "react",
    repo: "react",
    number: 37224,
    title:
      "[Compiler Bug]: Variable reassigned across two reactive scopes is clobbered by the later scope's cache restore",
    author: "v-iglesias",
    labels: ["Type: Bug", "Status: Unconfirmed"],
    raisedHoursAgo: 33
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 36980,
    title:
      "`Bun.serve`  expose sourcemaps by default even when running in production mode. (development:false) option",
    author: "d-ferreira",
    labels: ["bug", "needs triage"],
    comments: 2,
    raisedHoursAgo: 53
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 36957,
    title: '`node:fs`\'s watch only fires single "rename" event on file rename (MacOS)',
    author: "h-strand",
    labels: ["bug", "needs triage"],
    comments: 3,
    raisedHoursAgo: 60
  },
  {
    owner: "oven-sh",
    repo: "bun",
    number: 36866,
    title: "next build segfaults during page data collection with Next.js 16.3.0 (bun 1.3.14)",
    author: "l-duarte",
    comments: 5,
    raisedHoursAgo: 93
  },
  {
    owner: "microsoft",
    repo: "vscode",
    number: 328399,
    title:
      "macOS: VS Code 1.131 blocks Local Network access for integrated terminal/Remote-SSH (regression, works on 1.130)",
    author: "t-ahanu",
    labels: ["bug", "info-needed", "macos", "regression"],
    comments: 11,
    raisedHoursAgo: 179
  }
]

/**
 * One row, as the issue search answers it.
 *
 * The id is a key here and nothing else, since nothing on this stage is written and so
 * nothing is ever addressed by it. Every row is open, because the search this page
 * asks is `is:open`: a closed one on the screen would be a row the query it says it
 * ran could not have returned.
 */
const listedFrom = (row: Row): ListedIssue => ({
  reference: { owner: row.owner, repo: row.repo, number: row.number },
  id: `I_${row.repo}_${row.number}`,
  title: row.title,
  author: person(row.author),
  state: "open",
  comments: row.comments ?? 0,
  labels: row.labels ?? [],
  raisedAt: hoursAgo(row.raisedHoursAgo)
})

/**
 * One page, and the only one.
 *
 * GitHub pages this search at twenty-five, so twenty-two rows are all of them, and the
 * screen draws neither a count nor a pager over a list a reader can see the end of.
 * Both were drawn for a while and both said something the rows already said.
 */
const LISTED: ListedIssues = {
  rows: ROWS.map(listedFrom),
  pages: Option.some({ current: 1, total: 1, count: ROWS.length })
}

export const ISSUES_VIEW: View = {
  name: "issues",
  caption:
    "Every issue you were given, from every repository, on one page instead of three tabs of somebody else's dashboard",
  ...STORE,
  draw: () => (
    <IssuesScreen
      involvement="assigned"
      load={settled(LISTED)}
      preload={alreadyKnown(LISTED)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onGo={() => {}}
      onPage={() => {}}
      onStepAside={() => {}}
    />
  )
}
