/**
 * The step timeline, on a real pull request, in the real extension.
 *
 *     bun run build && ego-browser nodejs < scripts/verify-check-steps.js
 *
 * Opens a pull request with a red check, opens that check, and says what the
 * dialog is made of — the steps it listed, what each one cost, and whether the
 * failing one opened itself with its log under it. A screenshot goes beside it,
 * because a list of steps that reads correctly and looks wrong is still wrong.
 */

const PULL = "https://github.com/octo-org/octo-repo/pull/1555"
const SHOT = "/tmp/gitquiet-check-steps.png"

await useOrCreateTaskSpace("verify check steps")
await openOrReuseTab(PULL, { wait: true, timeout: 60 })
await wait(4)

const mounted = await js(String.raw`document.getElementById("gitquiet-root") !== null`)
cliLog(`Ours on the page: ${mounted}`)

// The red check, by the colour our own rows wear. A green run has none, in which
// case the first row will do — the timeline is the same either way.
const opened = await js(String.raw`
  (() => {
    const root = document.getElementById("gitquiet-root")
    if (root === null) return 'no root'
    const rows = [...root.querySelectorAll('button')]
      .filter((one) => /^ci \/ |^[a-z-]+ \(/.test((one.textContent ?? '').trim()))
    const red = rows.find((one) => one.querySelector('.text-fail')) ?? rows[0]
    if (red === undefined) return 'no check rows'
    red.click()
    return (red.textContent ?? '').trim().slice(0, 60)
  })()
`)
cliLog(`Opened: ${opened}`)

await wait(4)

const dialog = await js(String.raw`
  (() => {
    const box = document.querySelector('dialog[open]')
    if (box === null) return { open: false }

    const rows = [...box.querySelectorAll('button[aria-expanded]')].map((one) => ({
      step: (one.querySelector('span') ?? one).textContent?.trim(),
      took: one.lastElementChild?.textContent?.trim(),
      open: one.getAttribute('aria-expanded') === 'true',
      chore: one.hasAttribute('data-chore')
    }))

    return {
      open: true,
      title: box.getAttribute('aria-label'),
      headline: box.querySelector('p')?.textContent?.trim(),
      steps: rows,
      logLines: box.querySelectorAll('[class*="font-mono"]').length
    }
  })()
`)

cliLog(JSON.stringify(dialog, null, 2))

await captureScreenshot(SHOT)
cliLog(`Screenshot: ${SHOT}`)
