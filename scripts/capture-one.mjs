/**
 * Fetches the seven routes one pull request is read from, and nothing else.
 *
 * A cut-down `capture-drift.mjs` for answering one question: when a reader is told
 * "Something GitHub sends has changed", is a route not answering or is a payload in a
 * shape `wire.ts` does not know? Those look the same on the screen and are opposite
 * facts, so this writes what GitHub actually sent and `scripts/decode-one.ts` reads it.
 *
 *     mkdir -p /tmp/one-capture && ego-browser nodejs < scripts/capture-one.mjs
 *     bun scripts/decode-one.ts
 */

const WHERE = "/tmp/one-capture"

/** Edit for a run against something else. ego-browser starts this with its own env. */
const pullRequest = "OpenRouterIncubator/ori/pull/2068"

const PULL = `https://github.com/${pullRequest}`

const { writeFileSync } = await import("node:fs")

const kept = {}

/**
 * The first line of an HTML answer worth reading, which is its title.
 *
 * GitHub's crash page is `Unicorn! · GitHub` and their sign-in wall says so too, and
 * both arrive as HTML under a status that does not always say which. Kept beside the
 * status so a run answers "who refused, and why" without opening the body.
 */
const titleIn = (body) => {
  const found = /<title>([^<]*)<\/title>/i.exec(body)
  return found === null ? undefined : found[1].trim()
}

const grab = async (what, url) => {
  const got = await js(`(async () => {
    const response = await fetch(${JSON.stringify(url)}, {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include'
    })
    const text = await response.text()
    return { status: response.status, size: text.length, body: text, type: response.headers.get('content-type') }
  })()`)

  const json = (got.type ?? "").includes("json")
  kept[what] = {
    status: got.status,
    bytes: got.size,
    json,
    title: json ? undefined : titleIn(got.body)
  }
  writeFileSync(`${WHERE}/${what}.body`, got.body)
  cliLog(`${what}: ${got.status} ${json ? "json" : (titleIn(got.body) ?? "not json")} ${got.size}b`)
}

const task = await useOrCreateTaskSpace("one capture")
await takeOverTaskSpace(task.id)
await gotoAndWait(PULL, { timeout: 60, settle: 6 })

await grab("changes", `${PULL}/changes`)
await grab("status_checks", `${PULL}/page_data/status_checks`)
await grab("merge_box", `${PULL}/page_data/merge_box?bypass_requirements=false`)
await grab("header", `${PULL}/page_data/header`)
await grab("issue_comments", `${PULL}/page_data/issue_comments`)
await grab("description", `${PULL}/page_data/description`)
await grab("preview_stack", `${PULL}/page_data/preview_stack`)

writeFileSync(`${WHERE}/index.json`, JSON.stringify(kept, null, 1))
cliLog(JSON.stringify(kept, null, 1))
cliLog(JSON.stringify(await completeTaskSpace(task.id, { keep: false })))
