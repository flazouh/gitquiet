/**
 * Fetches every route `check-drift.ts` reads, from inside a logged-in page.
 *
 * Run with ego-browser, which hands this script a real browser:
 *
 *     mkdir -p /tmp/drift-capture && ego-browser nodejs < scripts/capture-drift.mjs
 *     DRIFT_FROM=/tmp/drift-capture bun scripts/check-drift.ts
 *
 * Why a browser rather than `fetch` in a shell: these routes authenticate with a
 * session, and the only copy of one is in the browser the reader is already signed in
 * to. Asking from inside a github.com page sends it with the request and never puts it
 * in an environment variable, a shell history, a terminal log or a file. So a drift
 * check costs a browser rather than a full account credential.
 *
 * Nothing here decodes. Each answer is written as the bytes GitHub sent, and
 * `check-drift.ts` reads them with the same schemas and the same page mining
 * production uses. The only knowledge repeated here is the six addresses that can only
 * be built from the answer before them, and they are read through {@link answerIn}, so
 * the next payload GitHub renames does not stop the capture.
 */

/**
 * Where the bodies go, as a constant rather than an environment variable: ego-browser
 * starts this script with an environment of its own, so a variable set on the command
 * line in front of it does not arrive.
 */
const WHERE = "/tmp/drift-capture"

/**
 * What the routes are asked about, and the same targets `check-drift.ts` defaults to.
 * Edit them here for a run against something else, for the reason `WHERE` gives.
 */
const pullRequest = "microsoft/vscode/pull/327442"
const repository = "microsoft/vscode"
const commit = "64b605d39db1f483fc95468f00cdc49e72f8d7bb"
const branch = "main"
const file = "README.md"
const issue = "microsoft/vscode/issues/1000"
const issueQuery = "repo:microsoft/vscode is:issue is:open"
const pullQuery = "repo:microsoft/vscode is:pr is:open"
const login = "gaearon"

const PULL = `https://github.com/${pullRequest}`
const REPO = `https://github.com/${repository}`
const [owner = "", name = ""] = repository.split("/")

/** The six shelves the Working Set reads, as `workingSet.ts` orders them. */
const SHELVES = [
  "needs-action",
  "team-review-requested",
  "waiting-for-review",
  "ready-to-merge",
  "your-drafts",
  "merge-queue"
]

const { writeFileSync } = await import("node:fs")

/**
 * Whatever GitHub wrapped an answer in this week.
 *
 * They are moving each payload under a single `<name>Route` key, one route at a time:
 * their repository home and file view have answered that way for a while, their issue
 * search moved on 2026-08-14 and their commit page and commit list on 2026-08-15. Only
 * the chaining below looks inside an answer, and it looks through this, so a rename
 * costs the schema a union and costs this script nothing.
 */
const answerIn = (payload) => {
  const keys = Object.keys(payload)
  return keys.length === 1 && /Route$/.test(keys[0]) ? payload[keys[0]] : payload
}

const slug = (what) => what.replace(/[^a-z0-9]+/gi, "-")

const kept = {}

/**
 * One route, asked for the way the gateway asks for it, written where the check reads.
 *
 * The five flavours are the five the gateway uses: their JSON routes want the
 * XMLHttpRequest header or answer 406, their repository filter wants a content type
 * instead, the two code view reads and an issue want the served document, and their
 * public events want no cookies at all.
 */
const grab = async (what, url, flavour = "json") => {
  if (url === undefined) {
    kept[slug(what)] = { status: 0, why: "no address, the route before it did not answer" }
    cliLog(`${what}: skipped`)
    return undefined
  }

  const got = await js(`(async () => {
    const asks = {
      json: { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' },
      filtered: { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, credentials: 'include' },
      page: { headers: { Accept: 'text/html' }, credentials: 'include' },
      plain: { credentials: 'include' },
      publicly: { headers: { Accept: 'application/json' }, credentials: 'omit' }
    }
    const response = await fetch(${JSON.stringify(url)}, asks[${JSON.stringify(flavour)}])
    const text = await response.text()
    return { status: response.status, size: text.length, body: text }
  })()`)

  kept[slug(what)] = { status: got.status, url }
  writeFileSync(`${WHERE}/${slug(what)}.body`, got.body)
  cliLog(`${what}: ${got.status}, ${got.size} bytes`)
  return got.status === 200 ? got.body : undefined
}

const task = await useOrCreateTaskSpace("drift capture")
await takeOverTaskSpace(task.id)
await gotoAndWait(REPO, { timeout: 60, settle: 6 })

const changes = await grab("changes", `${PULL}/changes`)
let heldBackDiffs
if (changes !== undefined) {
  const page = answerIn(JSON.parse(changes).payload)
  const carried = new Set(page.diffContents.map((one) => one.path))
  const held = page.diffSummaries.map((one) => one.path).filter((path) => !carried.has(path))
  // The first file where GitHub held none of them back, for the reason check-drift gives.
  const asked = held.length > 0 ? held : page.diffSummaries.slice(0, 1).map((one) => one.path)
  if (asked.length > 0) {
    const list = asked.map((path) => encodeURIComponent(path)).join(",")
    heldBackDiffs =
      `${PULL}/page_data/diff_entries?paths=${encodeURIComponent(list)}` +
      `&ctx=${encodeURIComponent(":::")}&w=0&range=${page.comparison.fullDiff.headOid}`
  }
}
await grab("diff_entries", heldBackDiffs)

await grab("status_checks", `${PULL}/page_data/status_checks`)
await grab("merge_box", `${PULL}/page_data/merge_box?merge_method=MERGE&bypass_requirements=false`)
await grab("header", `${PULL}/page_data/header`)
await grab("issue_comments", `${PULL}/page_data/issue_comments`)
await grab("description", `${PULL}/page_data/description`)
await grab("diffstat", `${PULL}/page_data/diffstat`)
await grab("preview_stack", `${PULL}/page_data/preview_stack`)

const one = await grab("commit", `${REPO}/commit/${commit}?_pjax=%23repo-content-pjax-container`)
let extraCommitDiffs
if (one !== undefined) {
  const page = answerIn(JSON.parse(one).payload)
  const from = page.asyncDiffLoadInfo
  const { sha1, sha2, oid } = page.commit
  if (from !== undefined && from !== null && typeof sha1 === "string" && typeof sha2 === "string") {
    extraCommitDiffs =
      `${REPO}/diffs?commit=${oid}&sha2=${sha2}&sha1=${sha1}` +
      `&start_entry=${from.startIndex}&bytes=${from.byteCount}&lines=${from.lineShownCount}`
  }
}
await grab("commit_diffs", extraCommitDiffs)

const commits = await grab("commits", `${REPO}/commits/${encodeURIComponent(branch)}`)
let deferredCommits
if (commits !== undefined) {
  const deferred = answerIn(JSON.parse(commits).payload).metadata?.deferredDataUrl
  // Their address carries the repository, and the repository asked about is on the
  // address here. `commits.ts` drops the owner and the name for the same reason.
  if (typeof deferred === "string") {
    deferredCommits = `${REPO}${deferred.replace(/^\/[^/]+\/[^/]+/, "")}`
  }
}
await grab("deferred_commits", deferredCommits)

await grab("branches", `${REPO}/refs?type=branch`)
await grab("authors", `${REPO}/commits/deferred_commit_contributors`)
await grab("sidebar", `${REPO}/_sidebar`)

// The document, because that is the shape production reads. The same route answers
// with the payload alone to `Accept: application/json`, which is the cheap way to the
// one field the two tree reads are keyed by.
await grab("repo_home", REPO, "page")
const head = await js(`(async () => {
  const response = await fetch('${REPO}', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' })
  const body = await response.json()
  const keys = Object.keys(body.payload)
  const answer = keys.length === 1 && /Route$/.test(keys[0]) ? body.payload[keys[0]] : body.payload
  return answer.refInfo ? answer.refInfo.currentOid : null
})()`)
await grab("tree_list", head === null ? undefined : `${REPO}/tree-list/${head}`)
await grab("tree_commit_info", head === null ? undefined : `${REPO}/tree-commit-info/${head}`)

const path = file.split("/").map(encodeURIComponent).join("/")
await grab("blob", `${REPO}/blob/${encodeURIComponent(branch)}/${path}`, "page")

for (const shelf of SHELVES) {
  await grab(
    `shelf ${shelf}`,
    `https://github.com/pulls/inbox/queries?filter=${shelf}&max_pr_age=1m`
  )
}

const listed = await grab(
  "pulls_query",
  `https://github.com/pulls?${new URLSearchParams({ q: pullQuery, page: "1" }).toString()}`
)
let deferredRows
if (listed !== undefined) {
  // Nine, because nine is what their own dashboard asks about at a time.
  const ids = answerIn(JSON.parse(listed).payload)
    .results.slice(0, 9)
    .map((row) => row.id)
  if (ids.length > 0) {
    deferredRows = `https://github.com/pulls/inbox/deferred?page=1&${ids.map((id) => `pr_ids%5B%5D=${id}`).join("&")}`
  }
}
await grab("pulls_deferred", deferredRows)

await grab("repositories", "https://github.com/_filter/repositories?q=&filter_value=", "filtered")
await grab(
  "issue_search",
  `https://github.com/search?${new URLSearchParams({ q: issueQuery, type: "issues", p: "1" }).toString()}`
)
await grab(
  "activity",
  `https://api.github.com/users/${encodeURIComponent(login)}/received_events/public?per_page=100`,
  "publicly"
)
await grab("issue", `https://github.com/${issue}`, "plain")
await grab(
  "mentionable",
  `https://github.com/suggestions/issue?mention_suggester=1&repository=${name}&user_id=${owner}`
)
await grab(
  "referable",
  `https://github.com/suggestions/issue?issue_suggester=1&repository=${name}&user_id=${owner}`
)

writeFileSync(`${WHERE}/index.json`, JSON.stringify(kept, null, 1))
cliLog(`${Object.keys(kept).length} routes written to ${WHERE}`)
cliLog(JSON.stringify(await completeTaskSpace(task.id, { keep: false })))
