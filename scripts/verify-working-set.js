/**
 * Checks the Working Set on github.com/pulls itself, signed in.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-working-set.js
 *
 * Signed in is the only state worth checking: the dashboard does not exist
 * otherwise, and every route it reads answers as if the reader has no pull
 * requests at all. `scripts/verify-on-github.ts` is the signed-out counterpart
 * for the pull request page, where the failure screen still answers the styling
 * questions.
 */

const PAGE = "https://github.com/pulls"

await useOrCreateTaskSpace("verify working set")
await openOrReuseTab(PAGE, { wait: true, timeout: 60 })

// The read is eight requests to GitHub, so the list is not there on the first frame.
await new Promise((wake) => setTimeout(wake, 6000))

const found = await js(String.raw`
  const root = document.getElementById('gitquiet-root')
  const text = (node) => (node?.textContent ?? '').trim()
  const seen = (element) => {
    if (element === null) return false
    for (let at = element; at !== null; at = at.parentElement) {
      if (at.hasAttribute?.('hidden')) return false
      const style = getComputedStyle(at)
      if (style.display === 'none' || style.visibility === 'hidden') return false
    }
    return true
  }

  const rows = [...(root?.querySelectorAll('a[aria-label]') ?? [])]
  // A <section> named by a heading is a region without carrying the attribute,
  // so its own h2 is what names it here.
  const courts = [...(root?.querySelectorAll('section') ?? [])]
    .map((region) => text(region.querySelector('h2')))
    .filter((name) => name.length > 0)
  const theirLayout = document.querySelector('[data-testid="pulls-dashboard-surface-layout"]')

  return JSON.stringify({
    // Ours is up, and in their layout rather than nailed somewhere else.
    mounted: root !== null,
    inTheirLayout: root?.parentElement?.getAttribute('data-testid') ?? null,
    taken: document.documentElement.hasAttribute('data-gitquiet-taken'),
    revealed: document.documentElement.hasAttribute('data-gitquiet-revealed'),
    gating: document.documentElement.hasAttribute('data-gitquiet-gating'),

    // What it is showing.
    courts,
    rows: rows.length,
    // Every stack and how deep each member sits, which is the one claim on this
    // page that cannot be checked from a count: three pull requests built one on
    // the next must come out as one tree three deep, not three trees of one.
    stacks: [...(root?.querySelectorAll('[role="tree"]') ?? [])].map((tree) =>
      [...tree.querySelectorAll('[role="treeitem"]')].map((item) => {
        let deep = 0
        for (let at = item.parentElement; at !== null && at !== tree; at = at.parentElement) {
          if (at.getAttribute('role') === 'group') deep += 1
        }
        return deep
      })
    ),
    firstRows: rows.slice(0, 6).map((row) => row.getAttribute('aria-label')),
    filterBox: root?.querySelector('input[type="search"]') !== null,
    loading: text(root).includes('Reading your pull requests'),
    failed: text(root).includes('could not be read') || text(root).includes('signed out'),

    // Theirs is hidden rather than destroyed, and the page around it survives.
    theirListStillInDom: theirLayout !== null,
    theirRowsVisible: [...(theirLayout?.querySelectorAll('[class*="ContentWrapper"]') ?? [])]
      .filter(seen).length,
    theirSiteHeader: seen(document.querySelector('.header-wrapper, header[role="banner"]')),

    // Drawn in GitHub's own typeface and surfaces, like every other screen here.
    ourFont: root === null ? null : getComputedStyle(root).fontFamily.slice(0, 40),
    theirFont: getComputedStyle(document.body).fontFamily.slice(0, 40),
    octicons: root?.querySelectorAll('svg.octicon').length ?? 0,
    ourWidth: root === null ? 0 : Math.round(root.getBoundingClientRect().width),
    viewport: window.innerWidth,
    // Anything wider than the window has a row with its right-hand end cut off.
    overflowing: (root?.scrollWidth ?? 0) > window.innerWidth
  }, null, 2)
`)

cliLog(found)

const it = JSON.parse(found)
const failures = [
  ["never mounted", !it.mounted],
  ["mounted outside GitHub's own layout", it.inTheirLayout !== "pulls-dashboard-surface-layout"],
  ["left the page gated, which is a blank screen", !it.revealed || it.gating],
  ["still reading after six seconds", it.loading],
  ["could not read the Working Set", it.failed],
  ["drew no rows at all", it.rows === 0],
  ["drew no Courts", it.courts.length === 0],
  ["is wider than the window, so rows are cut off", it.overflowing],
  [
    "drew a stack that is not a stack: every member at the same depth",
    it.stacks.some((depths) => depths.length > 1 && new Set(depths).size === 1)
  ],
  ["GitHub's own list is still visible underneath", it.theirRowsVisible > 0],
  ["destroyed GitHub's list rather than hiding it", !it.theirListStillInDom],
  ["took GitHub's site header with it", !it.theirSiteHeader],
  ["is not drawing in GitHub's typeface", it.ourFont !== it.theirFont],
  ["draws no Octicons", it.octicons === 0]
].filter(([, wrong]) => wrong)

if (failures.length === 0) {
  const deepest = Math.max(0, ...it.stacks.flat()) + 1
  cliLog(
    `PASS — ${it.rows} rows across ${it.courts.length} Courts, ` +
      `${it.stacks.length} stacks, deepest ${deepest}`
  )
} else {
  cliLog(`FAIL\n  ${failures.map(([why]) => why).join("\n  ")}`)
}
