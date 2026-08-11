/**
 * Where the wait before the Working Set actually goes.
 *
 * One request with four searches in it against four requests with one each, timed
 * against the reader's own account. Run before changing anything, because the
 * obvious answer — GitHub's search is slow, nothing to be done — and the other
 * obvious answer — four at once will be four times faster — are both guesses.
 *
 *   bun desktop/scripts/time-working-set.ts
 */

const token = (await Bun.$`gh auth token`.text()).trim()

const ROW = `
  fragment row on PullRequest {
    databaseId number title createdAt updatedAt isDraft state isReadByViewer
    headRefOid baseRefName headRefName additions deletions viewerDidAuthor
    repository { name owner { login } }
    author { login __typename avatarUrl }
    comments { totalCount }
    labels(first: 1) { totalCount }
    assignees(first: 1) { totalCount }
    reviewDecision
    mergeQueueEntry { state }
    commits(last: 1) {
      nodes { commit { statusCheckRollup { state contexts(first: 100) { totalCount nodes { __typename ... on CheckRun { conclusion } ... on StatusContext { state } } } } } }
    }
  }
`

/** The same four searches the app sends, by the name the app calls each one. */
const SHELVES = {
  mine: "is:open is:pr author:@me archived:false sort:updated",
  direct: "is:open is:pr user-review-requested:@me archived:false sort:updated",
  asked: "is:open is:pr review-requested:@me archived:false sort:updated",
  involved: "is:open is:pr involves:@me archived:false sort:updated"
} as const

const searchFor = (name: string, query: string) =>
  `${name}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: 50) { nodes { ...row } }`

const send = async (query: string) => {
  const at = Bun.nanoseconds()
  const answer = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query })
  })
  const body = (await answer.json()) as { readonly data?: Record<string, { nodes: unknown[] }> }
  const ms = Math.round((Bun.nanoseconds() - at) / 1e6)
  const rows = Object.values(body.data ?? {}).reduce((all, one) => all + (one?.nodes?.length ?? 0), 0)
  return { ms, rows }
}

const together = `query { ${Object.entries(SHELVES).map(([name, q]) => searchFor(name, q)).join("\n")} } ${ROW}`

const first = await send(together)
console.log(`one request, four searches: ${first.ms}ms, ${first.rows} rows`)

const apart = await Promise.all(
  Object.entries(SHELVES).map(async ([name, q]) => {
    const one = await send(`query { ${searchFor(name, q)} } ${ROW}`)
    return { name, ...one }
  })
)

for (const one of apart) console.log(`  ${one.name.padEnd(9)} alone: ${one.ms}ms, ${one.rows} rows`)

const slowest = Math.max(...apart.map((one) => one.ms))
console.log(`four at once: ${slowest}ms (the slowest of them), against ${first.ms}ms together`)

// A second time round, in case the first was a cold cache on their side.
const again = await send(together)
console.log(`one request again: ${again.ms}ms`)

/*
 * The same two searches with the check rollup taken out, which is the one part of
 * a row that cannot be answered from the search index: a tally of what passed
 * means walking up to a hundred contexts on the head commit of every row.
 */
const LEAN = ROW.replace(/commits\(last: 1\)[\s\S]*?\n  }/, "\n  }")

for (const name of ["mine", "involved"] as const) {
  const lean = await send(`query { ${searchFor(name, SHELVES[name])} } ${LEAN}`)
  console.log(`  ${name.padEnd(9)} without the check rollup: ${lean.ms}ms, ${lean.rows} rows`)
}
