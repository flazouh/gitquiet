/**
 * Checks the ⌘K palette: on Home, where the lists are already read, and on a pull request,
 * where they come out of the store.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-palette.js
 */

const HOME = "https://github.com/"
const PULL = "https://github.com/flowline-labs/flowline/pull/1934"

const rest = (ms) => new Promise((wake) => setTimeout(wake, ms))

/**
 * A tab already sitting on the address is reused without reloading, which leaves the content
 * script from before the last build running — and then every reading below is about old code.
 */
const freshly = async (page) => {
  await openOrReuseTab(page, { wait: true, timeout: 60 })
  await js(String.raw`location.reload(); return 'reloading'`)
  await rest(9000)
}

// ⌘K toggles, so shut whatever a previous run left open before pressing: a script that is not
// idempotent reads "closed" and looks like a bug in the thing it is checking.
const press = () =>
  js(String.raw`
    const open = document.querySelector('[role="dialog"][aria-label="Find anything you have"]')
    if (open !== null) {
      open.querySelector('[role="combobox"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )
    }
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k', metaKey: true, bubbles: true, cancelable: true
    }))
    return 'sent'
  `)

const reading = () =>
  js(String.raw`
    const dialog = document.querySelector('[role="dialog"][aria-label="Find anything you have"]')
    if (dialog === null) return JSON.stringify({ open: false })
    const at = dialog.getBoundingClientRect()
    const options = [...dialog.querySelectorAll('[role="option"]')]
    return JSON.stringify({
      open: true,
      left: Math.round(at.left),
      top: Math.round(at.top),
      width: Math.round(at.width),
      typing: document.activeElement?.getAttribute('role') ?? null,
      answers: options.length,
      first: (options[0]?.textContent ?? '').slice(0, 60),
      standing: options.findIndex((one) => one.getAttribute('aria-selected') === 'true')
    })
  `)

const type = (letters) =>
  js(
    String.raw`
    const box = document.querySelector('[role="combobox"]')
    if (box === null) return 'no box'
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(box, ` +
      JSON.stringify(letters) +
      String.raw`)
    box.dispatchEvent(new Event('input', { bubbles: true }))
    return 'typed'
  `
  )

await useOrCreateTaskSpace("verify palette")

// 1. Home: both lists are on the screen already.
await freshly(HOME)

const barOnHome = await js(String.raw`
  const bar = document.getElementById('gitquiet-bar')
  const search = bar?.querySelector('button')
  return JSON.stringify({
    bar: bar === null ? null : Math.round(bar.getBoundingClientRect().height),
    search: [...(bar?.querySelectorAll('button') ?? [])]
      .map((one) => (one.textContent ?? '').trim())
      .find((words) => words.includes('Search')) ?? null
  })
`)
console.log("home bar:", barOnHome)

await press()
await rest(600)
console.log("home palette, nothing typed:", await reading())

await type("ego")
await rest(400)
console.log("home palette, 'ego':", await reading())
await captureScreenshot("/tmp/palette-home.png")

await type("flowl")
await rest(400)
console.log("home palette, 'flowl':", await reading())

// 2. A pull request: the list has to come out of the store.
await freshly(PULL)

const barOnPull = await js(String.raw`
  const bar = document.getElementById('gitquiet-bar')
  return JSON.stringify({
    bar: bar === null ? null : Math.round(bar.getBoundingClientRect().height),
    search: [...(bar?.querySelectorAll('button') ?? [])]
      .map((one) => (one.textContent ?? '').trim())
      .find((words) => words.includes('Search')) ?? null
  })
`)
console.log("pull bar:", barOnPull)

await press()
await rest(600)
console.log("pull palette, out of the store:", await reading())
await captureScreenshot("/tmp/palette-pull.png")

await type("githubpro")
await rest(400)
console.log("pull palette, 'githubpro' out of the store:", await reading())

// A number, in the repository being read: four digits and Enter, which is the walk between two
// pull requests that their own interface asks for the address bar.
await type("1938")
await rest(400)
console.log("pull palette, '1938':", await reading())
await captureScreenshot("/tmp/palette-number.png")
