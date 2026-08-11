/**
 * Names every control in GitHub's global bar on Home, with selectors and widths.
 *
 *     bun run reload && ego-browser nodejs < scripts/probe-header-dom.js
 *
 * The bar is the last part of Home that is still entirely theirs. Before proposing anything
 * for it, this records what is in it, which parts the Rail already answers, and whether their
 * own key handlers reach the page while our filter is listening.
 */

await useOrCreateTaskSpace("probe header")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 6000))

const bar = await js(String.raw`
  const header = document.querySelector('header.AppHeader, .AppHeader, header')
  const nameOf = (node) =>
    (node.getAttribute('aria-label') ??
      node.getAttribute('title') ??
      (node.textContent ?? '').trim().slice(0, 40) ??
      '').trim()

  const controls = [...(header?.querySelectorAll('a, button, input, summary') ?? [])]
    .filter((one) => {
      const at = one.getBoundingClientRect()
      return at.width > 0 && at.height > 0
    })
    .map((one) => {
      const at = one.getBoundingClientRect()
      return {
        tag: one.tagName.toLowerCase(),
        name: nameOf(one),
        id: one.id || null,
        cls: (one.className ?? '').toString().split(/\s+/).slice(0, 2).join(' '),
        left: Math.round(at.left),
        width: Math.round(at.width)
      }
    })
    .sort((a, b) => a.left - b.left)

  const at = header?.getBoundingClientRect()
  return JSON.stringify(
    {
      header: header ? { tag: header.tagName.toLowerCase(), cls: (header.className ?? '').toString().slice(0, 80), height: Math.round(at.height) } : null,
      controls
    },
    null,
    1
  )
`)

console.log(bar)
