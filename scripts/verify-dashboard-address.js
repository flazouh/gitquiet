/**
 * Whether the Working Set survives GitHub moving the address underneath it.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-dashboard-address.js
 *
 * `/pulls` is not a page GitHub serves. It answers with the dashboard and then
 * redirects, client-side, to `/pulls/inbox` — so every arrival at the Working Set
 * by their own nav is two addresses, a tenth of a second apart.
 *
 * Every one of those addresses draws the same list: the Courts are read from
 * GitHub, not from the path. So the second address is this page arriving again,
 * and taking the list down to build an identical one is a hole in the page for as
 * long as the read takes — instant on a warm store, and however long GitHub takes
 * on a cold one. Which is what a reader sees as the page loading, then blanking.
 */

/** Counts the interface being put on the page and taken off it, per document. */
const RECORDER = String.raw`
(() => {
  window.__life = { events: [], heights: [] }
  let seen = 0
  const mark = (node) => {
    if (node.__ghproMark === undefined) node.__ghproMark = ++seen
    return node.__ghproMark
  }
  const note = (what, node) => window.__life.events.push({
    at: Math.round(performance.now()),
    what,
    which: mark(node),
    path: location.pathname
  })
  new MutationObserver((changes) => {
    for (const change of changes) {
      for (const node of change.addedNodes) {
        if (node.nodeType === 1 && node.id === 'gitquiet-root') note('put on the page', node)
      }
      for (const node of change.removedNodes) {
        if (node.nodeType === 1 && node.id === 'gitquiet-root') note('taken off it', node)
      }
    }
  }).observe(document, { childList: true, subtree: true })

  // What the reader sees, sampled: a list that goes back to nothing having once
  // been drawn is the hole this is looking for.
  setInterval(() => {
    const root = document.getElementById('gitquiet-root')
    window.__life.heights.push({
      at: Math.round(performance.now()),
      h: root === null ? -1 : Math.round(root.getBoundingClientRect().height),
      path: location.pathname
    })
  }, 40)
})()
`

await useOrCreateTaskSpace("verify dashboard address")
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER })

// `/pulls` rather than `/pulls/inbox`, because the redirect between them is the
// whole of what this is about.
await gotoUrl("https://github.com/pulls")

const drawn = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((wake) => setTimeout(wake, 1000))
    const ready = await js(String.raw`(() => {
      const root = document.getElementById('gitquiet-root')
      return root !== null && root.querySelectorAll('a[aria-label]').length > 0
    })()`)
    if (ready === true) return true
  }
  return false
}

if (!(await drawn())) cliLog("the Working Set never finished reading")
// Long enough for the redirect and anything it sets off to have happened.
await new Promise((wake) => setTimeout(wake, 4000))

const life = await js(String.raw`(() => window.__life)()`)
const here = (await pageInfo()).url

cliLog(`ended at ${here}`)
cliLog(life.events.map((e) => `${e.at}ms ${e.what} #${e.which} at ${e.path}`).join("\n"))

const problems = []

const puttings = life.events.filter((e) => e.what === "put on the page")
const takings = life.events.filter((e) => e.what === "taken off it")
const roots = new Set(puttings.map((e) => e.which))

if (!here.includes("/pulls")) problems.push(`never arrived at the dashboard, ended at ${here}`)
if (puttings.length === 0) problems.push("the Working Set was never put on the page")
if (roots.size > 1) {
  problems.push(`the list was built ${roots.size} times over, so the address change took it down and started again`)
}
if (takings.length > 0) {
  problems.push(`the list was taken off the page ${takings.length} time(s) while the reader was on it`)
}

/*
 * And the same thing measured as the reader meets it. A list that is drawn, then
 * gone, then drawn again is the flash — whatever the elements underneath did.
 */
const first = life.heights.findIndex((s) => s.h > 0)
const hole =
  first === -1 ? null : life.heights.slice(first).find((s) => s.h <= 0)
if (first === -1) problems.push("the list never had any height at all")
else if (hole !== undefined) {
  problems.push(`the list emptied at ${hole.at}ms on ${hole.path}, having been drawn at ${life.heights[first].at}ms`)
}

cliLog(
  problems.length === 0
    ? "PASS — one list, drawn once, across both addresses"
    : `FAIL\n  ${problems.join("\n  ")}`
)
