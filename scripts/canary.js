/**
 * Whether GitHub still looks the way the extension's hooks expect, checked against the
 * live site.
 *
 *     bun run canary
 *
 * The proactive half of the gate audit. `auditTakeover` hears a leak once a reader loads
 * the page; this loads the pages itself, on a schedule, so a rename is caught the day it
 * ships rather than the day someone hits it. It reads `src/ui/canary.manifest.json`, which
 * the build writes from the same `place.ts` table the gates use, and for each page asks the
 * two questions a running page can answer on its own:
 *
 *   1. Is a region on the page for the takeover to stand in.
 *   2. Does every band still match. A band whose narrow selector misses while its coarse
 *      family is still there is the shape of the Account rename: GitHub moved the markup
 *      out from under a label.
 *
 * It checks plain GitHub, with no extension loaded, so "matches" means the element is on
 * their page — which is all the gate needs to be able to find. Prints a line per page and a
 * PASS/FAIL at the end, and sets a non-zero exit code on any drift so a cron run goes red.
 *
 * The ego-browser window has to be visible and signed in: the modules on these pages
 * hydrate on paint, so a hidden window measures a page of zeroes. See `probe-home-dom.js`.
 */

const { readFileSync } = await import("node:fs")

// `bun run canary` replaces this with $PWD, the way shots/capture.js is run: ego's own
// working directory is not the repo, so the manifest is read by an absolute path.
const REPO = "__REPO__"
const manifest = JSON.parse(readFileSync(`${REPO}/src/ui/canary.manifest.json`, "utf8"))

/** The check that runs inside the page, built for one target's selectors. */
const inPage = (target) =>
  `(() => {
    const hit = (selector) => {
      try { return document.querySelector(selector) !== null } catch (error) { return null }
    }
    const regions = ${JSON.stringify(target.regions)}
    const bands = ${JSON.stringify(target.bands)}
    return JSON.stringify({
      regionHit: regions.some((selector) => hit(selector) === true),
      bands: bands.map((band) => ({
        narrow: band.narrow,
        coarse: band.coarse,
        narrowHit: hit(band.narrow),
        coarseHit: hit(band.coarse)
      }))
    })
  })()`

await useOrCreateTaskSpace("gitquiet canary")

const failures = []

for (const target of manifest.targets) {
  await openOrReuseTab(target.url, { wait: true, timeout: 90 })

  // Waited for by the region's own height, the way the probes are: the modules land after
  // the shell, and a page measured too early reads empty and cries drift that is not there.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const height = await js(
      `Math.round(document.querySelector('main, [data-testid="pulls-dashboard-surface-layout"], div.js-notifications-container')?.getBoundingClientRect().height ?? 0)`
    )
    if (height > 200) break
    await new Promise((resume) => setTimeout(resume, 500))
  }

  const read = JSON.parse(await js(inPage(target)))
  cliLog(`\n${target.page}  (${target.url})`)

  if (!read.regionHit) {
    failures.push(`${target.place}: no region on the page (${target.regions.join(", ")})`)
    cliLog(`  FAIL  no region — takeover has nowhere to stand`)
  } else {
    cliLog(`  ok    region found`)
  }

  for (const band of read.bands) {
    if (band.narrowHit === true) {
      cliLog(`  ok    band ${band.narrow}`)
    } else if (band.coarseHit === true) {
      failures.push(`${target.place}: band drifted — ${band.narrow} misses, ${band.coarse} is there`)
      cliLog(`  FAIL  band drifted — its family ${band.coarse} is still on the page`)
    } else {
      cliLog(`  warn  band matches nothing — ${band.narrow} (their feature may be gone)`)
    }
  }
}

cliLog("\n========================================================================")
if (failures.length === 0) {
  cliLog("CANARY PASS — every hook still finds GitHub's markup")
} else {
  cliLog(`CANARY FAIL (${failures.length})`)
  for (const failure of failures) cliLog(`  - ${failure}`)
  process.exitCode = 1
}
