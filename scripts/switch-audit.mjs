/**
 * Times every page switch this extension answers, from inside the build.
 *
 * Temporary, and it only reads what a marked build writes: `src/ui/mark.ts` and
 * its callers. Delete both together.
 *
 * No requestAnimationFrame anywhere in here. A task space window is not the
 * foreground window, so the frame clock is throttled and every number taken from
 * it measures the throttle rather than the product: an earlier run of this audit
 * reported eight hundred milliseconds for a switch that takes twenty-one.
 */

const AT = 'https://github.com/fluentai-pro/fluentai'
/*
 * A build with the marks in it, kept aside from `.output` so that a rebuild of the
 * product cannot quietly replace the instrument under a run. Made by adding
 * `src/ui/mark.ts` and its callers, building, and copying the result here.
 */
const BUILD = '/tmp/gitquiet-marked'

const task = await useOrCreateTaskSpace('honest switch audit')
await takeOverTaskSpace(task.id)
await cdp('Extensions.loadUnpacked', { path: BUILD }, null)

/** Watches the interface without a frame clock: mutations, and the marks the build writes. */
const install = async () =>
  js(String.raw`(() => {
  if (window.__audit !== undefined) return 'standing'
  const a = { click: null, drawn: null, first: null, last: null, moved: 0, doc: Date.now() }
  window.__audit = a
  window.addEventListener('click', () => { if (a.click === null) a.click = performance.now() }, true)
  new MutationObserver(() => {
    const root = document.getElementById('gitquiet-root')
    if (a.click === null || root === null) return
    const now = performance.now()
    a.moved += 1
    a.last = now
    if (a.first === null) a.first = now
    if (a.drawn === null && root.querySelectorAll('*').length > 30 && (root.textContent || '').length > 120) a.drawn = now
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  return 'fresh'
})()`)

const zero = async () =>
  js(String.raw`(() => {
  const a = window.__audit
  a.click = null; a.drawn = null; a.first = null; a.last = null; a.moved = 0
  document.documentElement.setAttribute('data-gitquiet-marks', '')
  return 'zeroed'
})()`)

/** The marks of one leg, each in milliseconds from the press. */
const readMarks = async () =>
  js(String.raw`(() => {
  const a = window.__audit
  const at = a.click
  if (at === null) return { missed: true }
  const since = (x) => x === null ? null : Math.round(x - at)
  const marks = (document.documentElement.getAttribute('data-gitquiet-marks') || '').split(' ').filter((x) => x !== '')
  const named = marks.map((one) => {
    const cut = one.lastIndexOf('@')
    return { what: one.slice(0, cut), at: Math.round(Number(one.slice(cut + 1)) - at) }
  })
  const firstOf = (prefix) => {
    const found = named.find((m) => m.what.indexOf(prefix) === 0)
    return found === undefined ? null : found.at
  }
  const asked = []
  for (const m of named) {
    const sent = m.what.indexOf('get:') === 0 || m.what.indexOf('gql:') === 0 || m.what.indexOf('page:') === 0
    const back = m.what.indexOf('get-back:') === 0 || m.what.indexOf('gql-back:') === 0 || m.what.indexOf('page-back:') === 0
    if (sent) asked.push({ of: m.what, at: m.at, took: null })
    if (back) {
      const of = m.what.replace('-back:', ':')
      const one = asked.find((x) => x.of === of && x.took === null)
      if (one !== undefined) one.took = m.at - one.at
    }
  }
  const slowest = asked.slice().sort((x, y) => (y.took || 0) - (x.took || 0))[0]
  return {
    address: firstOf('pushed:'),
    stood: firstOf('stand:'),
    taken: firstOf('taken:'),
    drawn: since(a.drawn),
    quiet: since(a.last),
    mutations: a.moved,
    requests: asked.length,
    joined: named.filter((m) => m.what.indexOf('joined:') === 0).length,
    slowest: slowest === undefined ? null : { took: slowest.took, of: slowest.of.slice(0, 64) },
    at: location.pathname
  }
})()`)

/** The first of these that is on the page, so a leg is skipped rather than fatal. */
const anyOf = async (selectors) =>
  js(
    String.raw`(() => { const want = ` +
      JSON.stringify(selectors) +
      String.raw`; for (const one of want) { if (document.querySelector(one) !== null) return one } return null })()`
  )

const rows = []

const leg = async (label, selectors, { settle = 8 } = {}) => {
  const fresh = await install()
  const selector = await anyOf(selectors)
  if (selector === null) {
    rows.push({ leg: label, missed: 'nothing on the page matched' })
    return
  }
  await zero()
  await click(selector, { label })
  await wait(settle)
  const got = await readMarks()
  rows.push({ leg: label, reloaded: fresh === 'fresh' && rows.length > 0, ...got })
}

const back = async (label, { settle = 8 } = {}) => {
  const fresh = await install()
  await js(String.raw`(() => { window.__audit.click = performance.now(); document.documentElement.setAttribute('data-gitquiet-marks', ''); window.__audit.drawn = null; window.__audit.last = null; window.__audit.first = null; window.__audit.moved = 0; history.back(); return 'went' })()`)
  await wait(settle)
  const got = await install().then(readMarks)
  rows.push({ leg: label, reloaded: fresh === 'fresh' && rows.length > 0, ...got })
}

await gotoAndWait(AT, { timeout: 45, settle: 8 })
await wait(6)

await leg('repo home -> pulls', ['#gitquiet-bar a[href$="/pulls"]'])
await leg('pulls -> a pull request', ['#gitquiet-root a[href*="/pull/"]'])
await back('back to pulls')
await leg('pulls -> repo issues', ['#gitquiet-bar a[href$="/issues"]', '#gitquiet-bar a[href*="/issues"]'])
await leg('issues -> an issue', [
  '#gitquiet-root a[href*="/issues/"]:not([href$="/new"]):not([href*="/new?"])'
])
await back('back to issues')
await leg('issues -> notifications', ['#gitquiet-bar a[href*="/notifications"]'])
await leg('notifications -> working set', ['#gitquiet-bar a[href="/pulls"]', '#gitquiet-bar a[href="/"]'])
await leg('working set -> a pull request', ['#gitquiet-root a[href*="/pull/"]'])

cliLog('')
cliLog('leg                              addr  stood  taken  drawn  quiet  reqs  joined  slowest')
for (const one of rows) {
  if (one.missed !== undefined) {
    cliLog(one.leg.padEnd(32) + ' skipped: ' + one.missed)
    continue
  }
  const cell = (x) => String(x === null ? '-' : x).padStart(5) + ' '
  cliLog(
    one.leg.padEnd(32) +
      cell(one.address) +
      cell(one.stood) +
      cell(one.taken) +
      cell(one.drawn) +
      cell(one.quiet) +
      String(one.requests).padStart(4) +
      ' ' +
      String(one.joined).padStart(6) +
      '  ' +
      (one.slowest === null ? '-' : one.slowest.took + 'ms ' + one.slowest.of)
  )
}
cliLog('')
cliLog('all times in milliseconds from the press. addr = the address moved, taken = the takeover')
cliLog('landed, drawn = the interface had a page in it, quiet = the last mutation of the leg.')

cliLog(JSON.stringify(await completeTaskSpace(task.id, { keep: false })))
