/**
 * Checks that the Rail and the column beside it start on the same line.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-home-inset.js
 *
 * The columns each used to carry their own padding, from when one of them was the whole page,
 * which put the filter box sixteen pixels further in and twelve lower than the Rail.
 */

const PAGE = "https://github.com/"

await useOrCreateTaskSpace("verify home inset")
await openOrReuseTab(PAGE, { wait: true, timeout: 60 })

await new Promise((wake) => setTimeout(wake, 7000))

// Onto the Working Set, which is the Destination whose filter row sat low.
await js(String.raw`
  const rail = document.querySelector('#gitquiet-root .t-rail')
  const going = [...(rail?.querySelectorAll('a, button') ?? [])].find((one) =>
    (one.textContent ?? '').includes('Working Set')
  )
  going?.click()
  return going === undefined ? 'no Working Set in the Rail' : 'pressed'
`)

await new Promise((wake) => setTimeout(wake, 3000))

const edges = await js(String.raw`
  const root = document.getElementById('gitquiet-root')
  const box = (node) => {
    if (!node) return null
    const at = node.getBoundingClientRect()
    return { left: Math.round(at.left), top: Math.round(at.top), width: Math.round(at.width) }
  }
  const rail = root?.querySelector('.t-rail')
  const beside = root?.querySelector('.t-panels')
  return JSON.stringify({
    rail: box(rail),
    column: box(beside),
    firstRow: box(beside?.firstElementChild),
    root: box(root)
  })
`)

console.log(edges)
console.log(await captureScreenshot("/tmp/home-inset.png"))
