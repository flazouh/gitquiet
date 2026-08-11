/**
 * Checks that everything of ours wears the scheme GitHub is wearing.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-theme.js
 *
 * Two faults this is the regression test for: the bar and the palette portal to the body, outside
 * the root the tokens are painted on, and painted white on a dark page; and "system" followed the
 * desktop rather than the page, so GitHub's dark theme on a light machine painted white as well.
 */

const rest = (ms) => new Promise((wake) => setTimeout(wake, ms))

const reading = () =>
  js(String.raw`
    const look = (node, label) => {
      if (!node) return [label, null]
      const style = getComputedStyle(node)
      return [label, { bg: style.backgroundColor, ink: style.color }]
    }
    const root = document.getElementById('gitquiet-root')
    const bar = document.getElementById('gitquiet-bar')
    return JSON.stringify(Object.fromEntries([
      ['mode', document.documentElement.getAttribute('data-color-mode')],
      look(bar?.querySelector('header'), 'bar'),
      look(root?.querySelector('.t-rail'), 'rail'),
      look(document.querySelector('[role="dialog"][aria-label="Find anything you have"]'), 'palette')
    ]))
  `)

const mode = (which) =>
  js(
    String.raw`document.documentElement.setAttribute('data-color-mode', ` +
      JSON.stringify(which) +
      String.raw`); return 'set'`
  )

await useOrCreateTaskSpace("verify palette")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await js(String.raw`location.reload(); return 'reloading'`)
await rest(9000)

// Open the palette, so it is measured with everything else.
await js(String.raw`
  const open = document.querySelector('[role="dialog"][aria-label="Find anything you have"]')
  if (open === null) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }
  return 'pressed'
`)
await rest(600)

console.log("as GitHub is set:", await reading())
await captureScreenshot("/tmp/theme-as-set.png")

await mode("light")
await rest(700)
console.log("their light, on a dark machine:", await reading())
await captureScreenshot("/tmp/theme-their-light.png")

await mode("dark")
await rest(700)
console.log("their dark:", await reading())
await captureScreenshot("/tmp/theme-their-dark.png")

await mode("auto")
await rest(500)
console.log("back to auto:", await reading())
