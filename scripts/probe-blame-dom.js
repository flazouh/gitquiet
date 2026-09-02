/**
 * Reads a file's blame page off a live GitHub, for the place the interface stands in.
 *
 *     ego-browser nodejs < scripts/probe-blame-dom.js
 *
 * Two questions, and neither is answerable from memory. Which region GitHub renders this
 * page into, so `BLAME` in `src/ui/place.ts` names a box that is really there. And what the
 * embedded payload carries, so `docs/spec/blame.md`'s Implementation Decisions describe a
 * shape read off the live document rather than guessed.
 *
 * The answer as recorded, read on `oven-sh/bun/blame/main/README.md`, 2026-09-01: the same
 * `#repo-content-pjax-container`, `turbo-frame#repo-content-turbo-frame` and
 * `react-app[app-name="code-view"]` that `REPO_HOME` already keys on — blame is one more
 * page of the same code view application. The one embedded `react-app.embeddedData` script
 * carries `payload.codeViewBlameRoute.blame` — `ranges` keyed by starting line number,
 * `commits` keyed by SHA, `ignoreRevs` naming `.git-blame-ignore-revs` — beside
 * `payload["codeViewBlobLayoutRoute.StyledBlob"].rawLines`, the same field `openedFrom`
 * already reads for `/blob`.
 */

await useOrCreateTaskSpace("probe blame dom")
await openOrReuseTab("https://github.com/oven-sh/bun/blame/main/README.md", {
  wait: true,
  timeout: 60
})

console.log(
  await js(String.raw`
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }
    }

    const regions = Object.fromEntries(
      [
        '#repo-content-pjax-container',
        'turbo-frame#repo-content-turbo-frame',
        'react-app'
      ].map((sel) => [sel, box(sel)])
    )

    const app = document.querySelector('react-app')

    const payload = document.querySelector(
      'script[type="application/json"][data-target="react-app.embeddedData"]'
    )
    let blameShape = null
    if (payload !== null) {
      const j = JSON.parse(payload.textContent)
      const blame = j.payload?.codeViewBlameRoute?.blame
      if (blame !== undefined) {
        blameShape = {
          rangeCount: Object.keys(blame.ranges ?? {}).length,
          commitCount: Object.keys(blame.commits ?? {}).length,
          ignoreRevs: blame.ignoreRevs
        }
      }
    }

    return JSON.stringify({ regions, appName: app?.getAttribute('app-name') ?? null, blameShape }, null, 1)
  `)
)
