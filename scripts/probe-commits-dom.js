/**
 * Reads a branch's commits page off a live GitHub, for the place the interface stands in.
 *
 *     ego-browser nodejs < scripts/probe-commits-dom.js
 *
 * Two questions, and neither is answerable from memory. Which region Turbo renders this
 * tab into, so `COMMITS` in `src/ui/place.ts` names a box that is really there. And what
 * only this tab has in it, so the soft gate can wait for the destination rather than
 * blanking the page a reader is still on.
 *
 * The answer as recorded: the same `#repo-content-pjax-container` and
 * `turbo-frame#repo-content-turbo-frame` a repository's pull request list uses — the same
 * box to the pixel — holding a `react-app` whose `app-name` is `commits`, with each row
 * marked `data-testid="commit-row-item"`.
 */

await useOrCreateTaskSpace("probe commits dom")
await openOrReuseTab("https://github.com/flazouh/githubpro/commits/main/", {
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

    // Every candidate region, so the place is chosen from what is on the page rather
    // than from what the pull request list happens to use.
    const regions = Object.fromEntries(
      [
        '#repo-content-pjax-container',
        'turbo-frame#repo-content-turbo-frame',
        'react-app',
        '[data-testid="commit-row-item"]'
      ].map((sel) => [sel, box(sel)])
    )

    // Up from the first row, so the gate's ancestor is chosen from real ones.
    const holders = []
    for (let at = document.querySelector('[data-testid="commit-row-item"]'); at !== null && holders.length < 8; at = at.parentElement) {
      holders.push({
        tag: at.tagName.toLowerCase(),
        id: at.id || null,
        testid: at.getAttribute('data-testid'),
        cls: (at.getAttribute('class') ?? '').slice(0, 60)
      })
    }

    const app = document.querySelector('react-app')

    return JSON.stringify({ regions, appName: app?.getAttribute('app-name') ?? null, holders }, null, 1)
  `)
)
