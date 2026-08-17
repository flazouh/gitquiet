/**
 * Measures what a signed-in participant waits for on GitHub's own pull request
 * page, and what the same pull request costs as data.
 *
 *     ego-browser nodejs < scripts/benchmark-signed-in.js
 *
 * Signed in is the only measurement worth quoting. Signed out, GitHub serves a
 * cheaper, cacheable page — around 68ms to first byte against 1,288ms — because
 * none of it is personalised. Nobody reviews pull requests signed out, so the
 * signed-out number flatters them for a page no reviewer ever sees.
 *
 * This runs through ego-browser rather than the CDP harness in chrome.ts
 * because it needs a real session, and ego-browser already has the one you use.
 * `scripts/benchmark-pull-request.ts` is the signed-out counterpart, kept for
 * the case a reader wants to reproduce something without an account.
 *
 * Every visit is a hard reload with the HTTP cache cleared: a reviewer opening
 * a pull request they have not opened before, with DNS, TLS and session warm.
 */

const TARGET = "microsoft/vscode/pull/327442"
const RUNS = 3

const PAGE = `https://github.com/${TARGET}`

/** The four routes the gateway reads to open a pull request. */
const ROUTES = [
  "/changes",
  "/page_data/status_checks",
  "/page_data/merge_box?bypass_requirements=false",
  "/page_data/description"
]

const task = await useOrCreateTaskSpace("benchmark github pr page")
await openOrReuseTab(PAGE, { wait: true, timeout: 60 })

const who = await js(String.raw`document.querySelector('meta[name="user-login"]')?.content ?? null`)
if (who === null) {
  cliLog("Signed out. These numbers would describe a page no reviewer sees; sign in first.")
} else {
  cliLog(`Measuring ${PAGE} as ${who}`)
}

// The resource timing buffer holds 250 entries by default and this page makes
// more than that, so it has to be raised before the document exists.
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: "performance.setResourceTimingBufferSize(5000)"
})

const visits = []
for (let run = 1; run <= RUNS; run++) {
  await cdp("Network.clearBrowserCache")
  await cdp("Page.reload", { ignoreCache: true })
  await wait(12)

  const visit = await js(String.raw`(() => {
    const nav = performance.getEntriesByType("navigation")[0]
    const resources = performance.getEntriesByType("resource")
    return {
      ttfb: Math.round(nav.responseStart),
      dom: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      requests: resources.length + 1,
      bytes: resources.reduce((total, entry) => total + (entry.transferSize || 0), 0) +
        (nav.transferSize || 0)
    }
  })()`)

  visits.push(visit)
  cliLog(
    `  run ${run}: ${visit.ttfb}ms to first byte, ${visit.load}ms to load, ` +
      `${visit.requests} requests, ${(visit.bytes / 1024 / 1024).toFixed(2)} MB`
  )
}

// The gateway asks for all four at once, so the wait is the slowest of them
// rather than their sum.
const data = await js(
  String.raw`(async () => {
    const routes = ` +
    JSON.stringify(ROUTES) +
    String.raw`
    const base = ` +
    JSON.stringify(PAGE) +
    String.raw`
    const started = performance.now()
    const bodies = await Promise.all(routes.map((route) =>
      fetch(base + route, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "include"
      }).then((response) => response.arrayBuffer())
    ))
    return {
      ms: Math.round(performance.now() - started),
      bytes: bodies.reduce((total, body) => total + body.byteLength, 0),
      sizes: bodies.map((body, at) => ({ route: routes[at], bytes: body.byteLength }))
    }
  })()`
)

const median = (numbers) => [...numbers].sort((left, right) => left - right)[Math.floor(numbers.length / 2)]

cliLog("")
for (const size of data.sizes) {
  cliLog(`  ${size.route.padEnd(58)} ${(size.bytes / 1024).toFixed(1).padStart(8)} KB`)
}

cliLog(`\n${"-".repeat(72)}`)
cliLog(`Median of ${RUNS} hard reloads of ${TARGET}, signed in\n`)
cliLog(`  ${median(visits.map((each) => each.ttfb)).toLocaleString("en-US")}ms to first byte`)
cliLog(`  ${median(visits.map((each) => each.load)).toLocaleString("en-US")}ms to load`)
cliLog(`  ${median(visits.map((each) => each.requests))} requests`)
cliLog(`  ${(median(visits.map((each) => each.bytes)) / 1024 / 1024).toFixed(2)} MB over the wire`)
cliLog(
  `\n  As data: ${ROUTES.length} requests, ${(data.bytes / 1024).toFixed(1)} KB, ` +
    `${data.ms.toLocaleString("en-US")}ms for all four at once`
)
