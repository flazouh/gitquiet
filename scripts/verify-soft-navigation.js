/**
 * Whether both interfaces arrive on a page GitHub never loaded.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-soft-navigation.js
 *
 * This is the path a content script cannot see. A `matches` pattern is tested
 * against the URL a *document* was loaded with, and GitHub does not load
 * documents — so arriving at either page by pressing a link on the other means
 * the script for it never runs unless the worker injects it.
 *
 * Both directions, because they fail differently. Into the dashboard the question
 * is whether the worker was asked at all. Out of it the question is whether being
 * asked was refused: our own list is on the page, and the check that used to guard
 * this looked for a rendered root rather than for the interface being asked for.
 */

const REPO = "https://github.com/octo-org/octo-repo"

/**
 * Waits for the interface to have finished reading, rather than for a number of
 * seconds. Both interfaces make several requests to GitHub before they can draw
 * anything, and how long that takes depends on the machine and on GitHub — a
 * fixed wait either fails on a busy laptop or wastes time on a quiet one.
 */
const drawn = async (what) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((wake) => setTimeout(wake, 1000))
    // Wrapped, because these run one after another in the page's own global
    // scope, and a second `const` of the same name is a syntax error there.
    const ready = await js(String.raw`(() => {
      const root = document.getElementById('gitquiet-root')
      if (root === null) return false
      return ${
        what === "list"
          ? "root.querySelectorAll('a[aria-label]').length > 0"
          : "(root.textContent ?? '').includes('Description')"
      }
    })()`)
    if (ready === true) return true
  }
  return false
}

const state = () =>
  js(String.raw`
    const root = document.getElementById('gitquiet-root')
    const seen = (element) => {
      if (element === null) return false
      for (let at = element; at !== null; at = at.parentElement) {
        if (at.hasAttribute?.('hidden')) return false
        const style = getComputedStyle(at)
        if (style.display === 'none' || style.visibility === 'hidden') return false
      }
      return true
    }
    const theirDashboard = document.querySelector('[data-testid="pulls-dashboard-surface-layout"]')

    return JSON.stringify({
      path: location.pathname,
      mounted: root !== null,
      inTheirLayout: root?.parentElement?.getAttribute('data-testid') ?? null,
      gating: document.documentElement.hasAttribute('data-gitquiet-gating'),
      courts: [...(root?.querySelectorAll('section') ?? [])]
        .map((region) => (region.querySelector('h2')?.textContent ?? '').trim())
        .filter((name) => name.length > 0),
      rows: root?.querySelectorAll('a[aria-label]').length ?? 0,
      filterBox: root?.querySelector('input[type="search"]') !== null,
      // The card, told apart from the list by what only it draws.
      card: (root?.textContent ?? '').includes('Description'),
      theirDashboardVisible:
        theirDashboard === null
          ? false
          : [...theirDashboard.querySelectorAll('[class*="ContentWrapper"]')].some(seen)
    })
  `).then(JSON.parse)

await useOrCreateTaskSpace("verify soft navigation")

// Somewhere on GitHub that is neither page, loaded properly, so nothing of ours
// is matched into the document to begin with.
await openOrReuseTab(REPO, { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 3000))

const problems = []

// 1. Their own nav into the dashboard. No document loads, so the Working Set can
//    only arrive if the worker was asked for it.
const pressed = await js(String.raw`
  const link = [...document.querySelectorAll('a')].find((a) => {
    const path = new URL(a.href, location.origin).pathname
    return path === '/pulls' || path.startsWith('/pulls/')
  })
  if (link === undefined) return 'no link to the dashboard on this page'
  link.click()
  return 'pressed ' + link.pathname
`)
cliLog(pressed)

if (!(await drawn("list"))) cliLog("the Working Set never finished reading")
const onDashboard = await state()
cliLog(`into the dashboard: ${JSON.stringify(onDashboard, null, 2)}`)

if (!onDashboard.path.startsWith("/pulls")) {
  problems.push(`never arrived at the dashboard, still on ${onDashboard.path}`)
} else {
  if (!onDashboard.mounted) problems.push("the Working Set was never injected")
  if (onDashboard.inTheirLayout !== "pulls-dashboard-surface-layout") {
    problems.push("the Working Set mounted outside GitHub's own layout")
  }
  if (onDashboard.rows === 0) problems.push("the Working Set drew no rows")
  if (onDashboard.gating) problems.push("the dashboard was left gated, which is a blank page")
  if (onDashboard.theirDashboardVisible) problems.push("GitHub's own list is still visible")
}

// 2. Back out of it, into a pull request. Ours is on the page now, which is the
//    case that used to be refused.
const opened = await js(String.raw`
  const row = document.querySelector('#gitquiet-root a[href*="/pull/"]')
  if (row === null) return 'no pull request row to press'
  row.click()
  return 'pressed ' + new URL(row.href, location.origin).pathname
`)
cliLog(opened)

if (!(await drawn("card"))) cliLog("the card never finished reading")
const onPullRequest = await state()
cliLog(`out to a pull request: ${JSON.stringify(onPullRequest, null, 2)}`)

if (!onPullRequest.path.includes("/pull/")) {
  problems.push(`never arrived at a pull request, still on ${onPullRequest.path}`)
} else {
  if (!onPullRequest.mounted) problems.push("the pull request card was never injected")
  if (!onPullRequest.card) problems.push("something mounted, but it is not the card")
  if (onPullRequest.gating) problems.push("the pull request was left gated, which is a blank page")
}

cliLog(problems.length === 0 ? "PASS — both interfaces arrive without a page load" : `FAIL\n  ${problems.join("\n  ")}`)
