/**
 * Whether the two things a row needs can be read for a stranger's pull request.
 *
 *     ego-browser nodejs < scripts/probe-repo-standings.js
 *
 * A repository's list is mostly pull requests the reader has nothing to do with.
 * The Working Set reads checks and review state from `/pulls/inbox/deferred`,
 * which is an *inbox* route — so the question is whether it answers about pull
 * requests that were never in the reader's inbox. If it does not, a repository
 * list can show no check state and no review state, and there is nothing to sort
 * rows by either.
 *
 * Also: how the search paginates, and whether it takes a sort, since a list that
 * cannot be ordered the way GitHub orders it would be a downgrade.
 */

const ASK = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

const STRANGER = "vercel/next.js"

await useOrCreateTaskSpace("probe repo list")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 2000))

const probe = async (label, expression) => {
  cliLog(`\n=== ${label} ===`)
  try {
    cliLog(String(await js(expression)))
  } catch (error) {
    cliLog(`failed: ${String(error).slice(0, 300)}`)
  }
}

// Checks and review state for pull requests nobody sent the reader.
await probe(
  "deferred standings for a stranger's pull requests",
  String.raw`(async () => {
    const url = 'https://github.com/pulls?q=' + encodeURIComponent('is:pr is:open repo:${STRANGER}')
    const listing = await (await fetch(url, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })).json()
    const rows = listing?.payload?.pullsDashboardSurfaceContentRoute?.results ?? []
    const ids = rows.slice(0, 9).map((row) => row.id)

    const deferred = 'https://github.com/pulls/inbox/deferred?page=1&' + ids.map((id) => 'pr_ids%5B%5D=' + id).join('&')
    const answer = await fetch(deferred, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    if (!answer.ok) return JSON.stringify({ status: answer.status, asked: ids.length })
    const body = await answer.json()
    const results = body?.payload?.pullsInboxSurfaceContentDeferredData?.results ?? []
    return JSON.stringify({
      status: answer.status,
      asked: ids.length,
      answered: results.length,
      payloadKeys: Object.keys(body?.payload ?? {}),
      sample: results.slice(0, 4),
      withChecks: results.filter((row) => row?.statusCheckRollup != null).length,
      withReview: results.filter((row) => row?.reviewDecisionState != null).length
    })
  })()`
)

// A second page, and whether the search will order itself.
await probe(
  "paging and sorting",
  String.raw`(async () => {
    const ask = async (query, page) => {
      const url = 'https://github.com/pulls?q=' + encodeURIComponent(query) + (page === undefined ? '' : '&page=' + page)
      const answer = await fetch(url, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
      if (!answer.ok) return { status: answer.status }
      const route = (await answer.json())?.payload?.pullsDashboardSurfaceContentRoute
      const rows = route?.results ?? []
      return {
        rows: rows.length,
        page: route?.pageInfo ?? null,
        first: rows[0]?.number ?? null,
        firstUpdated: rows[0]?.updatedAt ?? null
      }
    }
    return JSON.stringify({
      pageOne: await ask('is:pr is:open repo:${STRANGER}', 1),
      pageTwo: await ask('is:pr is:open repo:${STRANGER}', 2),
      sortedByUpdated: await ask('is:pr is:open repo:${STRANGER} sort:updated-desc', 1),
      sortedByOldest: await ask('is:pr is:open repo:${STRANGER} sort:created-asc', 1)
    })
  })()`
)

// What the merge box costs for a stranger's pull request, since stacks need it.
await probe(
  "branch names for a stranger's pull request",
  String.raw`(async () => {
    const url = 'https://github.com/pulls?q=' + encodeURIComponent('is:pr is:open repo:${STRANGER}')
    const listing = await (await fetch(url, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })).json()
    const row = (listing?.payload?.pullsDashboardSurfaceContentRoute?.results ?? [])[0]
    if (row === undefined) return 'no rows'

    const started = performance.now()
    const box = await fetch('https://github.com/${STRANGER}/pull/' + row.number + '/page_data/merge_box?merge_method=MERGE&bypass_requirements=false', { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    const took = Math.round(performance.now() - started)
    if (!box.ok) return JSON.stringify({ status: box.status, took })
    const body = await box.json()
    const size = JSON.stringify(body).length
    return JSON.stringify({
      status: box.status,
      took,
      kilobytes: Math.round(size / 1024),
      baseRefName: body?.pullRequest?.baseRefName ?? null,
      headRefName: body?.pullRequest?.headRefName ?? null
    })
  })()`
)
