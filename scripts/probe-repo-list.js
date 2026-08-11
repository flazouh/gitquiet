/**
 * What a repository's own pull request list can be read from.
 *
 *     ego-browser nodejs < scripts/probe-repo-list.js
 *
 * The Working Set is built from GitHub's six inbox shelves, which answer "pull
 * requests you are involved in" and carry a `category` this extension turns into a
 * Court. A repository's list answers a different question — every open pull
 * request in one repository, most of them nothing to do with the reader — so the
 * shelves cannot serve it.
 *
 * Three candidates, asked in order of how much they would save:
 *
 *   1. `/pulls?q=repo:owner/name is:open` — the dashboard's own search. Its rows
 *      are the shape this extension already decodes, so if it answers for a
 *      repository the reader has never touched, almost nothing new is needed. If
 *      it only ever answers about the reader, it is useless here.
 *   2. `/owner/name/pulls` asked for JSON — the page itself. Might carry branch
 *      names, which the shelves do not and which cost one request each today.
 *   3. `/owner/name/pulls/count` and friends — cheap counters, worth knowing about.
 *
 * Run signed in. Everything here goes through the browser's own session.
 */

const ASK = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

/** A repository the reader is certainly not a participant in. */
const STRANGER = "vercel/next.js"

await useOrCreateTaskSpace("probe repo list")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 2000))

const probe = async (label, expression) => {
  cliLog(`\n=== ${label} ===`)
  try {
    const answer = await js(expression)
    cliLog(typeof answer === "string" ? answer : JSON.stringify(answer, null, 1))
  } catch (error) {
    cliLog(`failed: ${String(error).slice(0, 300)}`)
  }
}

// 1. The dashboard's search, asked about a repository the reader is a stranger to.
await probe(
  `dashboard search, ${STRANGER}`,
  String.raw`(async () => {
    const url = 'https://github.com/pulls?q=' + encodeURIComponent('is:pr is:open repo:${STRANGER}')
    const answer = await fetch(url, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    if (!answer.ok) return JSON.stringify({ status: answer.status })
    const body = await answer.json()
    const route = body?.payload?.pullsDashboardSurfaceContentRoute
    const rows = route?.results ?? []
    return JSON.stringify({
      status: answer.status,
      payloadKeys: Object.keys(body?.payload ?? {}),
      routeKeys: Object.keys(route ?? {}),
      rowCount: rows.length,
      pageInfo: route?.pageInfo ?? null,
      fields: rows[0] === undefined ? null : Object.keys(rows[0]).sort(),
      authors: rows.slice(0, 8).map((row) => row?.author?.displayLogin ?? null),
      firstRow: rows[0] ?? null
    })
  })()`
)

// 2. The repository's own list, asked for JSON rather than a page.
await probe(
  `the repository's own list route, ${STRANGER}`,
  String.raw`(async () => {
    const answer = await fetch('https://github.com/${STRANGER}/pulls', { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    const kind = answer.headers.get('content-type')
    if (!(kind ?? '').includes('json')) return JSON.stringify({ status: answer.status, contentType: kind, note: 'not json — this page is rendered, not served' })
    const body = await answer.json()
    return JSON.stringify({ status: answer.status, contentType: kind, keys: Object.keys(body ?? {}) })
  })()`
)

// 3. The same search, about a repository the reader does work in, so the two can
//    be compared: a route that only ever answers about the reader looks fine here
//    and useless above.
await probe(
  "dashboard search, a repository the reader works in",
  String.raw`(async () => {
    const url = 'https://github.com/pulls?q=' + encodeURIComponent('is:pr is:open repo:flowline-labs/flowline')
    const answer = await fetch(url, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    if (!answer.ok) return JSON.stringify({ status: answer.status })
    const body = await answer.json()
    const rows = body?.payload?.pullsDashboardSurfaceContentRoute?.results ?? []
    return JSON.stringify({
      status: answer.status,
      rowCount: rows.length,
      titles: rows.map((row) => row?.title ?? null),
      authors: rows.map((row) => row?.author?.displayLogin ?? null),
      categories: rows.map((row) => row?.category ?? null),
      branchy: rows[0] === undefined ? null : Object.keys(rows[0]).filter((name) => /ref|branch|base|head|stack/i.test(name))
    })
  })()`
)
