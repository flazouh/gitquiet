/**
 * Reads the same stack from both places that draw it, to compare their direction.
 *
 *     ego-browser nodejs < scripts/probe-two-piles.js
 *
 * The Working Set draws a pile and the pull request header draws a chain. This
 * says which way up each one runs, in the order the rows are painted.
 */

const LIST = "https://github.com/flazouh/stack-probe/pulls"
const PAGE = "https://github.com/flazouh/stack-probe/pull/10"

const READ = String.raw`(() => {
  const root = document.getElementById("gitquiet-root")
  const shadow = root?.shadowRoot ?? root
  if (root === null) return JSON.stringify({ mounted: false })

  const rows = [...shadow.querySelectorAll('[role="treeitem"], ol[aria-label^="Stack"] li')]
    .map((row) => {
      const at = row.getBoundingClientRect()
      return { said: row.textContent?.slice(0, 40), top: Math.round(at.top), left: Math.round(at.left) }
    })
    .filter((row) => row.said !== undefined && row.said !== "")

  return JSON.stringify({ rows })
})()`

const task = await useOrCreateTaskSpace("test gitquiet extension on real PR")
await takeOverTaskSpace(task.id)

for (const where of [LIST, PAGE]) {
  await gotoAndWait(where, { timeout: 30, settle: 3 })
  await wait(3)
  cliLog(`--- ${where}`)
  cliLog(JSON.stringify(JSON.parse(await js(READ)), null, 1))
  cliLog(`shot: ${JSON.stringify(await captureScreenshot())}`)
}

await handOffTaskSpace(task.id)
