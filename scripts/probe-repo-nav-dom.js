/**
 * Reads GitHub's repository nav row off a live page, for the bar that replaces it.
 *
 *     bun run reload && ego-browser nodejs < scripts/probe-repo-nav-dom.js
 *
 * The bar in `docs/spec/top-bar.md` rebuilds this row from their own links rather than from a
 * list of nine tab names, so what matters here is which element holds them, how a count is
 * marked, and how the current tab says it is current.
 */

await useOrCreateTaskSpace("probe repo nav")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 6000))

const where = await js(String.raw`
  const row = document.querySelector('#gitquiet-root a[href*="/pull/"]')
  return row?.href ?? ''
`)

console.log("pull request:", where)
await openOrReuseTab(where, { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 6000))

console.log(
  await js(String.raw`
    // Every candidate holder, so the selector is chosen from what is there rather than from
    // memory of what GitHub called this in 2019.
    const item = [...document.querySelectorAll('[class*="UnderlineNav"]')].find(
      (one) => (one.textContent ?? '').trim() === 'Code'
    )

    // Up from the tab that says Code to whatever holds all of them, recording each step so the
    // selector can be chosen from real ancestors rather than from memory.
    const holders = []
    for (let at = item; at !== null && holders.length < 6; at = at.parentElement) {
      holders.push({
        tag: at.tagName.toLowerCase(),
        label: at.getAttribute('aria-label'),
        id: at.id || null,
        cls: (at.className ?? '').toString().slice(0, 90),
        links: at.querySelectorAll('a').length
      })
    }

    const row = item?.closest('nav') ?? item?.parentElement?.parentElement ?? null

    const links = [...(row?.querySelectorAll('a') ?? [])].map((one) => ({
      href: one.getAttribute('href'),
      text: (one.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
      dataView: one.getAttribute('data-view-component'),
      selected: one.getAttribute('aria-current'),
      countHtml: [...one.querySelectorAll('span')]
        .map((span) => ({
          cls: (span.className ?? '').toString().slice(0, 40),
          id: span.id || null,
          text: (span.textContent ?? '').trim().slice(0, 12)
        }))
        .filter((span) => span.text.length > 0)
    }))

    return JSON.stringify({ holders, rowLabel: row?.getAttribute('aria-label') ?? null, links }, null, 1)
  `)
)
