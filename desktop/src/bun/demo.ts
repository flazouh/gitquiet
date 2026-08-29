import { Effect } from "effect"
import type {
  Asked,
  Card,
  CardFacts,
  CheckFacts,
  CommitDetailFacts,
  CommitFacts,
  FaceFacts,
  FileFacts,
  RemarkFacts,
  ReviewFacts,
  SaidFacts,
  ThreadFacts,
  Viewer,
  WorkingSetRow
} from "../shared/wire"

/**
 * A whole GitHub, invented, for the times the real one must not be on screen.
 *
 * Recording the window means putting somebody's pull requests in a video, and
 * the ones a maintainer actually has open are the ones under embargo, in a
 * private repository, or titled after a customer. So this answers every request
 * the window makes with data of its own: a signed-in account nobody owns, a list
 * with a three-deep stack in it because the stack is the thing worth showing,
 * and cards whose diffs are small enough to read on a screen at 1280 wide.
 *
 * It is a demo and not a fake for tests. Tests already have builders and
 * recorded payloads, and they check behaviour; this exists to be looked at, so
 * the titles read like work, the checks disagree with each other, and the
 * threads have someone being slightly wrong in them.
 *
 * Nothing here reaches the network, not even for a face: an avatar is an inline
 * SVG, so the whole demo runs with the wifi off — which is the state a
 * conference room is usually in.
 */

/** Set by the `demo` script rather than by the app, exactly as the inspector is. */
export const inDemo = process.env["GITQUIET_DEMO"] === "1"

const ago = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * A face, drawn rather than fetched.
 *
 * Two letters on a coloured disc, which is what GitHub falls back to anyway for
 * an account with no picture. Base64 rather than a URL-encoded SVG because the
 * markup carries `#` in every colour and encoding that by hand is a bug waiting
 * for the one colour somebody forgets.
 */
const face = (initials: string, colour: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${colour}"/><text x="32" y="41" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="600" fill="#ffffff" text-anchor="middle">${initials}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

const VIEWER: Viewer = {
  login: "mirahalden",
  name: "Mira Halden",
  avatar: face("MH", "#6e5cf7")
}

const somebody = (login: string, initials: string, colour: string): FaceFacts => ({
  login,
  isAutomated: false,
  faceUrl: face(initials, colour)
})

const PEOPLE = {
  mira: somebody("mirahalden", "MH", "#6e5cf7"),
  kai: somebody("kai-ito", "KI", "#2f81f7"),
  noor: somebody("noor-abadi", "NA", "#bf5af2"),
  ilse: somebody("ilse-vandermeer", "IV", "#e3663e"),
  robot: { login: "vercel", isAutomated: true, faceUrl: face("V", "#1f2328") } as FaceFacts
} as const

/**
 * One row, with the fields nobody is looking at filled in from one place.
 *
 * Sixteen of the twenty-eight fields on a row say the same thing on every row in
 * a demo, and writing them out ten times is ten chances to write a list where
 * one pull request has no author because a comma moved.
 *
 * The default that matters is `viewerIsAuthor`. A row that is neither the
 * reader's own nor asked of them or their team is on none of GitHub's shelves,
 * and the Working Set is built out of shelf queries — so it is not a row that
 * appears further down the list, it is a row that never appears at all. Two of
 * these were written before that was noticed, and the list quietly drew eighteen
 * of twenty.
 */
const row = (
  it: Partial<WorkingSetRow> & Pick<WorkingSetRow, "id" | "owner" | "repo" | "number" | "title">
): WorkingSetRow => ({
  authorLogin: VIEWER.login,
  authorIsBot: false,
  authorFaceUrl: PEOPLE.mira.faceUrl,
  state: "open",
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: ago(60 * 26),
  changedAt: ago(90),
  headSha: "0".repeat(40),
  added: 0,
  deleted: 0,
  baseBranch: "main",
  headBranch: "work",
  checks: null,
  reviewed: null,
  viewerIsAuthor: true,
  askedOfViewer: false,
  askedOfTeam: false,
  inMergeQueue: false,
  ...it
})

/**
 * The list the window opens on.
 *
 * Arranged so that all three Courts have something in them and the first thing
 * on screen is the stack: three pull requests in `vercel/next.js` where each one
 * is based on the branch below it, which is the arrangement GitHub itself only
 * learned to draw in July and the reason this product exists. The foundation is
 * approved and green, so the pile sits in Needs You and the two above it say
 * they are waiting on it rather than claiming to be ready.
 *
 * The rest is a Saturday's worth of ordinary: somebody else's fix waiting on the
 * reader, one of the reader's own with a failing check, two out for review, one
 * GitHub is landing, and three that are done.
 */
const STARTING: ReadonlyArray<WorkingSetRow> = [
  row({
    id: 9001,
    owner: "vercel",
    repo: "next.js",
    number: 71204,
    title: "Split the router cache from the fetch cache",
    baseBranch: "canary",
    headBranch: "cache/split-router",
    headSha: "a1c93f27e5b04d8f6a1220ee7c4f9b3d5e8a7c11",
    added: 412,
    deleted: 168,
    comments: 6,
    labels: 2,
    changedAt: ago(35),
    checks: { state: "passing", total: 14, passed: 14 },
    reviewed: "approved"
  }),
  row({
    id: 9002,
    owner: "vercel",
    repo: "next.js",
    number: 71219,
    title: "Key the router cache by segment path",
    baseBranch: "cache/split-router",
    headBranch: "cache/segment-keys",
    headSha: "b7742de0913f5c6a8e2b41d09f7a6c35be1249ab",
    added: 233,
    deleted: 41,
    comments: 3,
    changedAt: ago(28),
    checks: { state: "passing", total: 14, passed: 14 },
    reviewed: "approved"
  }),
  row({
    id: 9003,
    owner: "vercel",
    repo: "next.js",
    number: 71230,
    title: "Delete the legacy prefetch adapter",
    baseBranch: "cache/segment-keys",
    headBranch: "cache/drop-legacy",
    headSha: "c04ab5619d7e2f38a5c7104be9d2f6178acb3320",
    added: 18,
    deleted: 604,
    changedAt: ago(12),
    checks: { state: "running", total: 14, passed: 9 },
    reviewed: "review-required"
  }),
  row({
    id: 9004,
    owner: "oven-sh",
    repo: "bun",
    number: 14882,
    title: "Fix Bun.serve() dropping keep-alive sockets under load",
    authorLogin: PEOPLE.kai.login,
    authorFaceUrl: PEOPLE.kai.faceUrl,
    viewerIsAuthor: false,
    askedOfViewer: true,
    baseBranch: "main",
    headBranch: "serve/keep-alive",
    headSha: "d51f7c2380ba469e17c5d0f8a3b62e94517cc8de",
    added: 96,
    deleted: 12,
    comments: 4,
    changedAt: ago(51),
    checks: { state: "passing", total: 9, passed: 9 },
    reviewed: "review-required"
  }),
  row({
    id: 9005,
    owner: "microsoft",
    repo: "vscode",
    number: 231447,
    title: "Restore terminal scroll position after a window reload",
    baseBranch: "main",
    headBranch: "terminal/restore-scroll",
    headSha: "e9026b4471dc3f8a0512ba6e7c9d4318f0ab52c7",
    added: 74,
    deleted: 9,
    comments: 2,
    labels: 1,
    changedAt: ago(140),
    checks: { state: "failing", total: 11, passed: 9 },
    reviewed: "review-required"
  }),
  row({
    id: 9006,
    owner: "oven-sh",
    repo: "bun",
    number: 14901,
    title: "wip: source maps for the standalone bundler",
    state: "draft",
    baseBranch: "main",
    headBranch: "bundler/source-maps",
    headSha: "f3b81c0592ae7d461b8c2d5f70a9e31427cd6b08",
    added: 301,
    deleted: 22,
    changedAt: ago(220),
    checks: { state: "running", total: 9, passed: 4 }
  }),
  row({
    id: 9007,
    owner: "denoland",
    repo: "deno",
    number: 26011,
    title: "Support import maps in deno bench",
    baseBranch: "main",
    headBranch: "bench/import-maps",
    headSha: "1a7d5e9042bc86f3d17e0c5ba49f28610cd7e3b5",
    added: 187,
    deleted: 34,
    comments: 1,
    changedAt: ago(300),
    checks: { state: "passing", total: 7, passed: 7 },
    reviewed: "review-required"
  }),
  row({
    id: 9008,
    owner: "withastro",
    repo: "astro",
    number: 12194,
    title: "Warn when an island imports a server-only module",
    baseBranch: "main",
    headBranch: "islands/server-only-warning",
    headSha: "2b48ce7150da39f6e7c018b5a2df946130ec7b41",
    added: 129,
    deleted: 6,
    comments: 5,
    changedAt: ago(760),
    checks: { state: "passing", total: 6, passed: 6 },
    reviewed: "review-required"
  }),
  row({
    id: 9009,
    owner: "tailwindlabs",
    repo: "tailwindcss",
    number: 14855,
    title: "Cache the candidate scanner between builds",
    baseBranch: "next",
    headBranch: "oxide/scanner-cache",
    headSha: "3c5901bde748a2f61079cb5d3ea28f4471bd60ac",
    added: 244,
    deleted: 96,
    comments: 8,
    changedAt: ago(95),
    checks: { state: "passing", total: 12, passed: 12 },
    reviewed: "approved",
    inMergeQueue: true
  }),
  row({
    id: 9010,
    owner: "vitejs",
    repo: "vite",
    number: 18422,
    title: "Skip the pre-bundle scan for single-file entries",
    state: "merged",
    baseBranch: "main",
    headBranch: "optimizer/skip-scan",
    headSha: "4d7e21ab9053cf618b2d70ae5c93f14082be7d19",
    added: 62,
    deleted: 143,
    comments: 3,
    changedAt: ago(1_500),
    checks: { state: "passing", total: 8, passed: 8 },
    reviewed: "approved"
  }),
  row({
    id: 9011,
    owner: "remix-run",
    repo: "react-router",
    number: 12010,
    title: "Type the loader data through the route tree",
    state: "merged",
    baseBranch: "dev",
    headBranch: "types/loader-data",
    headSha: "5e0c93af7126db4801f5a7e2c9b634d17ea08fc2",
    added: 508,
    deleted: 211,
    comments: 12,
    changedAt: ago(2_900),
    checks: { state: "passing", total: 10, passed: 10 },
    reviewed: "approved"
  }),
  row({
    id: 9012,
    owner: "nodejs",
    repo: "node",
    number: 55391,
    title: "Document the fetch keep-alive default",
    state: "closed",
    baseBranch: "main",
    headBranch: "doc/fetch-keep-alive",
    headSha: "6f21b8e05c7d43ae9012fb5c8d7e3a4915cb07ef",
    added: 14,
    deleted: 2,
    comments: 2,
    changedAt: ago(4_200)
  }),
  /*
   * A second stack, and deliberately not in the Court the first one is in.
   *
   * The foundation here is out for review rather than approved, so the pile sits
   * under Waiting and the pull request above it says it is waiting
   * rather than ready — which is the answer GitHub's own list gets wrong, and so
   * the one worth having twice on screen.
   */
  row({
    id: 9013,
    owner: "oven-sh",
    repo: "bun",
    number: 14930,
    title: "Move the runtime to Zig 0.14",
    baseBranch: "main",
    headBranch: "zig/upgrade-0-14",
    headSha: "7ac02fd913eb5c48a1739be05df2c68410ba9d72",
    added: 1_842,
    deleted: 1_301,
    comments: 11,
    labels: 3,
    changedAt: ago(64),
    checks: { state: "passing", total: 9, passed: 9 },
    reviewed: "review-required"
  }),
  row({
    id: 9014,
    owner: "oven-sh",
    repo: "bun",
    number: 14944,
    title: "Drop the shims the old std library needed",
    baseBranch: "zig/upgrade-0-14",
    headBranch: "zig/std-cleanup",
    headSha: "8bd13ae0724fc59b6182ce93da71f5028cb4e061",
    added: 31,
    deleted: 288,
    comments: 2,
    changedAt: ago(44),
    checks: { state: "passing", total: 9, passed: 9 },
    reviewed: "approved"
  }),
  /* Somebody has asked the reader by name, and it is a robot. */
  row({
    id: 9015,
    owner: "microsoft",
    repo: "vscode",
    number: 231502,
    title: "Bump esbuild from 0.24.0 to 0.25.1",
    authorLogin: "renovate",
    authorIsBot: true,
    authorFaceUrl: null,
    viewerIsAuthor: false,
    askedOfViewer: true,
    readByViewer: false,
    baseBranch: "main",
    headBranch: "renovate/esbuild-0-x",
    headSha: "9c2413be0785df6a1b40ce927fa5316807bd4e2f",
    added: 8,
    deleted: 8,
    comments: 1,
    labels: 1,
    changedAt: ago(19),
    checks: { state: "passing", total: 11, passed: 11 },
    reviewed: "review-required"
  }),
  /* Asked of a team the reader is on, which is a different sentence to being asked. */
  row({
    id: 9016,
    owner: "denoland",
    repo: "deno",
    number: 26044,
    title: "Add a permission prompt for reading the keychain",
    authorLogin: PEOPLE.ilse.login,
    authorFaceUrl: PEOPLE.ilse.faceUrl,
    viewerIsAuthor: false,
    askedOfTeam: true,
    readByViewer: false,
    baseBranch: "main",
    headBranch: "permissions/keychain-prompt",
    headSha: "0d84f2eb37a915c60be74d1298fa53c7401bd6e9",
    added: 356,
    deleted: 27,
    comments: 7,
    labels: 2,
    changedAt: ago(78),
    checks: { state: "failing", total: 7, passed: 5 },
    reviewed: "review-required"
  }),
  /* The reader's own, with somebody waiting on a change rather than on a review. */
  row({
    id: 9017,
    owner: "withastro",
    repo: "astro",
    number: 12208,
    title: "Stream the island payload instead of buffering it",
    baseBranch: "main",
    headBranch: "islands/stream-payload",
    headSha: "1e95a3fc4862db70cf815ae239b64d0851ca7f38",
    added: 274,
    deleted: 61,
    comments: 9,
    changedAt: ago(115),
    checks: { state: "passing", total: 6, passed: 6 },
    reviewed: "changes-requested"
  }),
  /* A draft of the reader's own that has been sitting there a fortnight. */
  row({
    id: 9019,
    owner: "tailwindlabs",
    repo: "tailwindcss",
    number: 14790,
    title: "wip: a smaller theme for the docs preview",
    state: "draft",
    baseBranch: "next",
    headBranch: "docs/smaller-theme",
    headSha: "3b7c50ea1946fd82b05c7e63af914d270ec8b5a4",
    added: 47,
    deleted: 12,
    openedAt: ago(60 * 24 * 14),
    changedAt: ago(60 * 24 * 11),
    checks: null
  }),
  /* Closed rather than landed, which is most of what Settled is for. */
  row({
    id: 9020,
    owner: "remix-run",
    repo: "react-router",
    number: 12043,
    title: "Revert the loader data types",
    state: "closed",
    baseBranch: "dev",
    headBranch: "revert/loader-data-types",
    headSha: "4ca72fb60d38519ce7a1b04f28ed9a3517cb6270",
    added: 211,
    deleted: 508,
    comments: 6,
    changedAt: ago(1_900)
  })
]

const named = (card: Card): string => `${card.owner}/${card.repo}#${card.number}`

/**
 * One hunk, with its header counted rather than written.
 *
 * The first attempt wrote the `@@` line by hand and the renderer threw
 * `hunk has too many context lines` — which took the whole card down, because a
 * patch that will not parse is not a state the file browser has a drawing for.
 * A count of the body cannot disagree with the body.
 */
const hunk = (oldStart: number, newStart: number, label: string, body: string): string => {
  const lines = body.split("\n")
  const before = lines.filter((line) => line.startsWith(" ") || line.startsWith("-")).length
  const after = lines.filter((line) => line.startsWith(" ") || line.startsWith("+")).length

  return `@@ -${oldStart},${before} +${newStart},${after} @@${label === "" ? "" : ` ${label}`}\n${body}`
}

/** A patch small enough to read on screen, and shaped like the file it claims to be. */
const PATCHES: Record<string, string> = {
  "packages/next/src/client/components/router-reducer/router-cache.ts": hunk(
    18,
    18,
    `import { fetchServerResponse } from "./fetch-server-response"`,
    ` 
-export function createCache() {
-  const entries = new Map<string, CacheNode>()
+export function createRouterCache({ max = 512 }: CacheOptions = {}) {
+  // The fetch cache and the router cache were one map, so a revalidation of a
+  // page dropped the layouts above it and the tree was rebuilt on every nav.
+  const entries = new LruCache<string, CacheNode>({ max })
 
   return {
-    get(key: string) {
-      return entries.get(key)
+    get(key: CacheKey) {
+      return entries.get(serialize(key))
     },
-    set(key: string, node: CacheNode) {
-      entries.set(key, node)
+    set(key: CacheKey, node: CacheNode) {
+      entries.set(serialize(key), node)
     }
   }
 }`
  ),
  "packages/next/src/client/components/router-reducer/cache-key.ts": hunk(
    0,
    1,
    "",
    `+/** A segment path and the search that produced it, in one comparable string. */
+export type CacheKey = {
+  readonly segments: ReadonlyArray<string>
+  readonly search: string
+}
+
+export const serialize = ({ segments, search }: CacheKey): string =>
+  \`\${segments.join("/")}?\${search}\`
+
+export const isPrefixOf = (outer: CacheKey, inner: CacheKey): boolean =>
+  outer.segments.every((segment, at) => inner.segments[at] === segment)`
  ),
  "packages/next/src/client/components/router-reducer/reducers/navigate-reducer.ts": hunk(
    204,
    204,
    "function navigateReducer(state: ReadonlyReducerState, action: NavigateAction) {",
    `-  const cached = cache.get(href)
+  const cached = cache.get({ segments, search })
   if (cached !== undefined && !cached.stale) {
     return handleMutable(state, { cache: cached, patchedTree: cached.tree })
   }
 
-  const response = fetchServerResponse(url, state.tree, state.nextUrl)
+  const response = fetchServerResponse(url, state.tree, state.nextUrl, { key })`
  ),
  "test/e2e/app-dir/router-cache/router-cache.test.ts": hunk(
    41,
    41,
    `describe("router cache", () => {`,
    `+  it("keeps a layout when a page below it revalidates", async () => {
+    const browser = await next.browser("/dashboard/reports")
+    const before = await browser.elementById("layout-instance").text()
+
+    await browser.elementById("revalidate-page").click()
+    await retry(async () => {
+      expect(await browser.elementById("report-count").text()).toBe("12")
+    })
+
+    expect(await browser.elementById("layout-instance").text()).toBe(before)
+  })`
  ),
  "src/vs/workbench/contrib/terminal/browser/terminalInstance.ts": hunk(
    1_284,
    1_284,
    "export class TerminalInstance extends Disposable implements ITerminalInstance {",
    `-  private _restoreFromLayout(): void {
-    this.xterm?.scrollToBottom()
+  private _restoreFromLayout(state: ITerminalLayoutState): void {
+    // Scrolling to the bottom threw away where the reader was, which on a
+    // reload of a window with a build log in it is the whole of the context.
+    const line = state.scrollLine ?? this.xterm?.buffer.active.baseY
+    if (line === undefined) return
+    this.xterm?.scrollToLine(line)
   }`
  ),
  "src/bun.js/api/server.zig": hunk(
    2_871,
    2_871,
    "pub fn onRequestComplete(this: *RequestContext) void {",
    `-    if (this.keep_alive) {
-        this.socket.close(0, null);
+    if (this.keep_alive and !this.aborted) {
+        // Closing a keep-alive socket the moment the response flushed dropped
+        // pipelined requests already in the kernel buffer.
+        this.socket.flush();
+        this.pending_requests -|= 1;
+        return;
     }`
  )
}

const FILES: Record<string, ReadonlyArray<string>> = {
  "vercel/next.js#71204": [
    "packages/next/src/client/components/router-reducer/router-cache.ts",
    "packages/next/src/client/components/router-reducer/reducers/navigate-reducer.ts",
    "test/e2e/app-dir/router-cache/router-cache.test.ts"
  ],
  "vercel/next.js#71219": [
    "packages/next/src/client/components/router-reducer/cache-key.ts",
    "packages/next/src/client/components/router-reducer/router-cache.ts",
    "test/e2e/app-dir/router-cache/router-cache.test.ts"
  ],
  "microsoft/vscode#231447": ["src/vs/workbench/contrib/terminal/browser/terminalInstance.ts"],
  "oven-sh/bun#14882": ["src/bun.js/api/server.zig"]
}

const marked = (patch: string, sign: "+" | "-"): number =>
  patch.split("\n").filter((line) => line.startsWith(sign)).length

/**
 * A total, shared out among the files that have no patch of their own.
 *
 * The row says how big the pull request is and the card draws the same figure
 * from its files, so the two have to agree: the list said `+412 −168` while the
 * card two presses later said `+108 −21`, which is the kind of thing a viewer
 * notices in a video and nobody notices while building one. The written patches
 * count for what they actually contain and the rest of the total goes to the
 * files GitHub has not been asked for yet, one line each at the very least.
 */
const shared = (total: number, spent: number, among: number): ReadonlyArray<number> => {
  if (among === 0) return []

  const left = Math.max(among, total - spent)
  const each = Math.floor(left / among)

  return Array.from({ length: among }, (_, at) =>
    at === among - 1 ? left - each * (among - 1) : each
  )
}

/**
 * The paths a card shows, and where their content is.
 *
 * A path with a patch written for it says `here` and carries it. Everything else
 * says `unasked`, which is the honest answer for a demo as much as for GitHub: a
 * file browser that only ever has content is a file browser with its loading
 * state untested, and the loading state is on camera too.
 */
const filesOf = (card: Card, row: WorkingSetRow): ReadonlyArray<FileFacts> => {
  const known = FILES[named(card)] ?? []
  const extra = [
    "docs/upgrading/version-15.mdx",
    "packages/next/src/server/lib/router-utils/resolve-routes.ts",
    "scripts/check-types.ts"
  ]

  // Two more than the written ones where there are written ones, and one to three
  // otherwise, so that not every card in the demo is a card of three files.
  const paths =
    known.length > 0 ? [...known, ...extra.slice(0, 2)] : extra.slice(0, 1 + (row.number % 3))

  const patches = paths.map((path) => PATCHES[path])
  const written = patches.filter((patch): patch is string => patch !== undefined)
  const guessing = patches.length - written.length

  const addeds = shared(
    row.added,
    written.reduce((total, patch) => total + marked(patch, "+"), 0),
    guessing
  )
  const deleteds = shared(
    row.deleted,
    written.reduce((total, patch) => total + marked(patch, "-"), 0),
    guessing
  )

  let guessed = -1

  return paths.map((path, at) => {
    const patch = patches[at]
    if (patch === undefined) guessed += 1

    return {
      path,
      digest: `${row.headSha.slice(0, 7)}-${at}`,
      changeType: path.endsWith("cache-key.ts") ? "added" : "modified",
      linesAdded: patch === undefined ? (addeds[guessed] ?? 1) : marked(patch, "+"),
      linesDeleted: patch === undefined ? (deleteds[guessed] ?? 1) : marked(patch, "-"),
      readByViewer: at !== 0 && at % 2 === 0,
      content: patch === undefined ? "unasked" : "here",
      patch: patch ?? null
    }
  })
}

/**
 * The list as it stands now, which a press is allowed to change.
 *
 * A demo where merging does nothing is a demo of a button. The verbs write here,
 * so a pull request closed on camera stays closed, moves to Settled on the next
 * read, and the card behind it agrees with the row in front of it.
 */
const rows: Array<WorkingSetRow> = STARTING.map((it) => ({ ...it }))

const rowFor = (card: Card): WorkingSetRow | undefined =>
  rows.find((it) => it.owner === card.owner && it.repo === card.repo && it.number === card.number)

const commitsOf = (row: WorkingSetRow): ReadonlyArray<CommitFacts> => {
  const headlines = [
    "Pull the cache out from under the fetch layer",
    "Serialise the segment path once, at the edge",
    "Cover the revalidation case that started this"
  ]

  return headlines.slice(0, row.state === "draft" ? 1 : 3).map((headline, at) => ({
    sha: `${row.headSha.slice(0, 32)}${at}${at}${at}${at}${at}${at}${at}${at}`.slice(0, 40),
    abbreviatedSha: `${row.headSha.slice(at, at + 7)}`,
    author: row.authorLogin,
    headline,
    createdAt: ago(300 - at * 80)
  }))
}

const said = (author: FaceFacts, body: string, minutes: number): SaidFacts => ({
  author,
  body,
  html: `<p>${body}</p>`,
  createdAt: ago(minutes)
})

const threadsOf = (card: Card): ReadonlyArray<ThreadFacts> => {
  if (named(card) !== "vercel/next.js#71204") return []

  return [
    {
      id: "thread-open",
      isResolved: false,
      at: {
        path: "packages/next/src/client/components/router-reducer/router-cache.ts",
        side: "after",
        line: 24,
        startLine: 22
      },
      comments: [
        said(
          PEOPLE.noor,
          "512 entries is a lot to hold for a site with one route. Can this take the count from the segment tree instead of a constant?",
          180
        ),
        said(
          PEOPLE.mira,
          "It can, but not in this one — the tree is not built yet at the point the cache is created. Following up in the branch above.",
          150
        )
      ]
    },
    {
      id: "thread-done",
      isResolved: true,
      at: {
        path: "test/e2e/app-dir/router-cache/router-cache.test.ts",
        side: "after",
        line: 48,
        startLine: 48
      },
      comments: [said(PEOPLE.ilse, "Nice — this is exactly the case that regressed in 14.2.", 200)]
    }
  ]
}

const remarksOf = (card: Card): Array<RemarkFacts> => {
  if (named(card) !== "vercel/next.js#71204") return []

  return [
    {
      id: "remark-1",
      ...said(
        PEOPLE.mira,
        "Three of these go together: this one splits the cache, the next keys it, and the third deletes the adapter nothing calls any more. Reviewing them in that order is much less work than reviewing the squash.",
        1_400
      )
    },
    {
      id: "remark-2",
      ...said(PEOPLE.robot, "Deployment preview ready: next-cache-split-router.vercel.app", 40)
    }
  ]
}

const CHECK_NAMES = [
  "build",
  "test (ubuntu-latest)",
  "test (macos-14)",
  "lint",
  "types",
  "e2e (chrome)"
] as const

/**
 * Checks that disagree, which is the only interesting case.
 *
 * The row already says how many passed, so the names are dealt out to match it:
 * a failing row gets a failure on the check a reader would actually go and read,
 * and a running row leaves the last one unfinished.
 */
const checksOf = (row: WorkingSetRow): ReadonlyArray<CheckFacts> => {
  if (row.checks === null) return []

  const total = Math.min(row.checks.total, CHECK_NAMES.length)
  return CHECK_NAMES.slice(0, total).map((name, at) => {
    const failing = row.checks?.state === "failing" && name === "test (ubuntu-latest)"
    const running = row.checks?.state === "running" && at >= total - 2

    return {
      name,
      state: failing ? "failed" : running ? "running" : "succeeded",
      isRequired: at < 4,
      summary: failing
        ? "1 failing test: terminal restores scroll position"
        : running
          ? "In progress"
          : "Successful in 4m 12s",
      url: `https://github.com/${row.owner}/${row.repo}/actions/runs/1${row.number}${at}`,
      durationSeconds: failing ? 291 : running ? 64 : 252 - at * 11
    }
  })
}

const reviewsOf = (row: WorkingSetRow): ReadonlyArray<ReviewFacts> => {
  if (row.reviewed === "approved") {
    return [
      { reviewer: PEOPLE.noor, decision: "approved" },
      { reviewer: PEOPLE.ilse, decision: "commented" }
    ]
  }
  if (row.reviewed === "changes-requested") {
    return [{ reviewer: PEOPLE.noor, decision: "changes-requested" }]
  }
  return []
}

/**
 * What GitHub would say about landing this one.
 *
 * `BLOCKED` where a review is still owed and `CLEAN` where it is not, because
 * the merge card reads the status rather than the review list, and a demo where
 * every pull request offers its merge button is a demo of one state.
 */
const mergeOf = (row: WorkingSetRow): CardFacts["merge"] => ({
  ways: ["MERGE", "SQUASH", "REBASE"],
    mergeable: "MERGEABLE",
  status: row.state === "draft" ? "DRAFT" : row.reviewed === "approved" ? "CLEAN" : "BLOCKED",
  mayBypass: false,
  mayUpdateBranch: row.number === 71230,
  whyNotUpdate: [],
  autoMerge: null,
  queue: row.inMergeQueue
    ? {
        waiting: true,
        position: 2,
        mayQueue: false,
        url: `https://github.com/${row.owner}/${row.repo}/queue/next`
      }
    : { waiting: false, position: null, mayQueue: row.reviewed === "approved", url: null }
})

const BODIES: Record<string, string> = {
  "vercel/next.js#71204": `## What this does

The router cache and the fetch cache were one map keyed by \`href\`, so revalidating a page dropped every layout above it and the tree was rebuilt on the next navigation. This gives the router its own cache, keyed by segment path.

**This is the foundation of three.** The two above it key the cache properly and delete the adapter that nothing calls afterwards.

### Measured on the dashboard app

| | before | after |
| --- | --- | --- |
| nav after revalidate | 340ms | 41ms |
| layouts rebuilt | 4 | 0 |

Closes #70988.`,
  "vercel/next.js#71219": `Builds on #71204. Replaces the \`href\` string key with a segment path and search pair, so a prefix match can answer for a child route without a second entry.

No behaviour change on its own — the win arrives with the adapter deletion above.`,
  "vercel/next.js#71230": `Builds on #71219. The legacy prefetch adapter existed to translate \`href\` keys for the old cache. Nothing calls it now.

600 lines out, one export gone from the internal surface.`
}

const cardOf = (card: Card, row: WorkingSetRow): CardFacts => ({
  title: row.title,
  markdown: BODIES[named(card)] ?? `Ordinary work in \`${row.repo}\`, described briefly.`,
  html: "",
  state: row.state,
  openedAt: row.openedAt,
  closedAt: row.state === "closed" ? row.changedAt : null,
  mergedAt: row.state === "merged" ? row.changedAt : null,
  author: row.viewerIsAuthor ? PEOPLE.mira : PEOPLE.kai,
  baseBranch: row.baseBranch,
  headBranch: row.headBranch,
  headSha: row.headSha,
  baseSha: `${row.headSha.slice(8)}${row.headSha.slice(0, 8)}`,
  viewerLogin: VIEWER.login,
  lastReviewPoint: null,
  files: filesOf(card, row),
  commits: commitsOf(row),
  threads: threadsOf(card),
  remarks: remarksOf(card),
  checks: checksOf(row),
  reviews: reviewsOf(row),
  merge: mergeOf(row)
})

/**
 * The cards as they stand, built on first ask and kept afterwards.
 *
 * Kept because a demo writes: a remark said on camera has to still be there when
 * the reader comes back from the file they opened to check something.
 */
const cards = new Map<string, CardFacts>()

const heldCard = (card: Card): Effect.Effect<CardFacts, Error> =>
  Effect.suspend(() => {
    const row = rowFor(card)
    if (row === undefined) {
      return Effect.fail(new Error(`Nothing in the demo at ${named(card)}.`))
    }

    const already = cards.get(named(card))
    if (already !== undefined) return Effect.succeed(already)

    const made = cardOf(card, row)
    cards.set(named(card), made)
    return Effect.succeed(made)
  })

const keep = (card: Card, next: CardFacts): void => {
  cards.set(named(card), next)
}

export const demoViewer = (): Effect.Effect<Viewer> => Effect.succeed(VIEWER)

export const demoRows = (): Effect.Effect<ReadonlyArray<WorkingSetRow>> =>
  Effect.suspend(() => Effect.succeed(rows.map((it) => ({ ...it }))))

export const demoCard = (card: Card): Effect.Effect<CardFacts, Error> => heldCard(card)

export const demoPatches = (
  card: Card,
  paths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<{ readonly path: string; readonly patch: string | null }>, Error> =>
  Effect.map(heldCard(card), (held) =>
    paths.map((path) => ({
      path,
      patch:
        PATCHES[path] ??
        hunk(
          1,
          1,
          "",
          ` // ${path}
-const held = read(path)
+const held = read(path, { encoding: "utf8" })
+// Written for the demo, which has no repository behind it.
 export default held`
        )
    }))
  )

/**
 * One commit, made out of the card it belongs to.
 *
 * The panel wants files, and the card already has plausible ones; inventing a
 * second set would mean a commit whose diff has nothing to do with the pull
 * request it is inside.
 */
export const demoCommit = (
  owner: string,
  repo: string,
  sha: string
): Effect.Effect<CommitDetailFacts, Error> =>
  Effect.suspend(() => {
    const row = rows.find((it) => it.owner === owner && it.repo === repo)
    if (row === undefined) return Effect.fail(new Error(`No demo repository called ${owner}/${repo}.`))

    const card = { owner, repo, number: row.number }
    return Effect.map(heldCard(card), (held) => ({
      sha,
      abbreviatedSha: sha.slice(0, 7),
      headline: held.commits[0]?.headline ?? "A commit of the demo",
      bodyHtml: null,
      author: row.authorLogin,
      avatarUrl: row.authorFaceUrl,
      createdAt: ago(120),
      files: held.files.slice(0, 2)
    }))
  })

/**
 * A verb, done to the demo rather than to GitHub.
 *
 * Both halves are written: the row, so the list moves the pull request into the
 * Court the verb implies on the next read, and the card, so the merge box behind
 * it does not go on offering to merge something that has merged. A refusal is
 * worth having on camera too, which is why queueing a pull request nobody
 * approved says no in the same words GitHub would.
 */
export const demoWrite = (card: Card, asked: Asked): Effect.Effect<void, Error> =>
  Effect.suspend(() => {
    const row = rowFor(card)
    if (row === undefined) return Effect.fail(new Error(`Nothing in the demo at ${named(card)}.`))

    const at = rows.indexOf(row)
    const put = (next: Partial<WorkingSetRow>): void => {
      rows[at] = { ...row, ...next, changedAt: new Date().toISOString() }
    }

    switch (asked.doing) {
      case "merge":
        if (row.reviewed !== "approved") {
          return Effect.fail(new Error("At least 1 approving review is required by reviewers with write access."))
        }
        put({ state: "merged", inMergeQueue: false })
        break
      case "close":
        put({ state: "closed" })
        break
      case "reopen":
        put({ state: "open" })
        break
      case "markReady":
        put({ state: "open" })
        break
      case "toDraft":
        put({ state: "draft" })
        break
      case "enqueue":
        if (row.reviewed !== "approved") {
          return Effect.fail(new Error("This branch cannot be added to the merge queue until it is approved."))
        }
        put({ inMergeQueue: true })
        break
      case "dequeue":
        put({ inMergeQueue: false })
        break
      case "cancelAutoMerge":
        break
      case "updateBranch":
        put({ headSha: `${row.headSha.slice(2)}ab` })
        break
    }

    const after = rows[at]
    const held = cards.get(named(card))
    if (after !== undefined && held !== undefined) {
      keep(card, {
        ...held,
        state: after.state,
        headSha: after.headSha,
        mergedAt: after.state === "merged" ? after.changedAt : null,
        closedAt: after.state === "closed" ? after.changedAt : null,
        merge: mergeOf(after)
      })
    }

    return Effect.void
  })

export const demoSayOnLines = (
  card: Card,
  asked: {
    readonly path: string
    readonly line: number
    readonly startLine: number
    readonly body: string
  }
): Effect.Effect<ThreadFacts, Error> =>
  Effect.map(heldCard(card), (held) => {
    const thread: ThreadFacts = {
      id: `thread-${Date.now()}`,
      isResolved: false,
      at: { path: asked.path, side: "after", line: asked.line, startLine: asked.startLine },
      comments: [said(PEOPLE.mira, asked.body, 0)]
    }

    keep(card, { ...held, threads: [...held.threads, thread] })
    return thread
  })

export const demoRemark = (card: Card, body: string): Effect.Effect<RemarkFacts, Error> =>
  Effect.map(heldCard(card), (held) => {
    const remark: RemarkFacts = { id: `remark-${Date.now()}`, ...said(PEOPLE.mira, body, 0) }

    keep(card, { ...held, remarks: [...held.remarks, remark] })
    return remark
  })
