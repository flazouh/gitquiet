/**
 * Leaves exactly one copy of this extension answering the page: the one just
 * built.
 *
 *     bun run build && ego-browser nodejs < scripts/one-copy.js          # off
 *     bun run build && ego-browser nodejs < scripts/one-copy.js --back   # on again
 *
 * Every measurement here is worthless without it. A copy installed from the
 * store attaches on navigation and wins `#gitquiet-root`, so a run that installs
 * the build under test and never checks again reports the store's numbers under
 * the branch's name. It did, twice, before this existed.
 *
 * `Extensions.uninstall` will not touch a copy from the store — "extension is
 * not an unpacked extension" — so the switch on their own extensions page is the
 * one way in, and it is three shadow roots down.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const PAGE = "https://github.com/pulls"
const BACK = process.argv.includes("--back")

const task = await useOrCreateTaskSpace("one copy")
await takeOverTaskSpace(task.id)

await cdp("Emulation.setFocusEmulationEnabled", { enabled: true })
await cdp("Page.bringToFront")

const servingHere = async () =>
  JSON.parse(
    await js(String.raw`(() => {
      const ids = new Set()
      for (const node of document.querySelectorAll("[src],[href]")) {
        const found = String(node.getAttribute("src") || node.getAttribute("href") || "")
          .match(/chrome-extension:\/\/([a-z]{32})/)
        if (found !== null) ids.add(found[1])
      }
      return JSON.stringify([...ids])
    })()`)
  )

/** Every copy of anything installed, as their own page sees it. */
const READ_THEM = String.raw`(() => {
  const manager = document.querySelector("extensions-manager")
  if (manager === null) return JSON.stringify({ trouble: "no manager on this page" })
  const list = manager.shadowRoot.querySelector("extensions-item-list")
  if (list === null) return JSON.stringify({ trouble: "no list under the manager" })
  const items = [...list.shadowRoot.querySelectorAll("extensions-item")].map((item) => ({
    id: item.id,
    name: item.shadowRoot.querySelector("#name")?.textContent?.trim(),
    on: item.shadowRoot.querySelector("#enableToggle")?.getAttribute("aria-pressed") === "true"
  }))
  return JSON.stringify(items)
})()`

const flip = (id) =>
  js(String.raw`(() => {
    const manager = document.querySelector("extensions-manager")
    const list = manager?.shadowRoot?.querySelector("extensions-item-list")
    const item = list?.shadowRoot?.querySelector("extensions-item#" + ${JSON.stringify(id)})
    const toggle = item?.shadowRoot?.querySelector("#enableToggle")
    if (toggle == null) return "no switch for " + ${JSON.stringify(id)}
    toggle.click()
    return "flipped " + ${JSON.stringify(id)}
  })()`)

/*
 * Installed before the switches are read, so that the build under test has a
 * switch of its own to find. An unpacked copy loaded while it is switched off
 * stays off, which reads from the page as no interface at all.
 */
let mine = null
try {
  const installed = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
  mine = installed.id
} catch (trouble) {
  cliLog(`could not install the build under test: ${String(trouble)}`)
}

const listThem = async () => {
  await gotoAndWait("chrome://extensions/", { timeout: 60, settle: 3 })
  await wait(2)
  const answer = JSON.parse(await js(READ_THEM))
  if (answer.trouble !== undefined) {
    cliLog(`Their extensions page will not answer: ${answer.trouble}`)
    throw new Error(answer.trouble)
  }
  return answer
}

const them = await listThem()
for (const one of them) cliLog(`${one.on ? "on " : "off"}  ${one.id}  ${one.name}`)

/*
 * By name rather than by a written-down id. The store's id is fixed but an
 * unpacked one is derived from the path, so a build in a worktree has a
 * different one and a list written by id would quietly leave it running.
 */
const ours = them.filter((one) => /gitquiet/i.test(one.name ?? ""))

for (const one of ours) {
  const wanted = BACK ? one.id !== mine : one.id === mine
  if (one.on === wanted) continue
  cliLog(await flip(one.id))
  await wait(1)
}

for (const one of await listThem()) {
  if (/gitquiet/i.test(one.name ?? "")) cliLog(`${one.on ? "on " : "off"}  ${one.id}  ${one.name}`)
}

if (BACK) {
  cliLog("put back")
} else {
  await gotoAndWait(PAGE, { timeout: 60, settle: 3 })
  await wait(4)
  const serving = await servingHere()
  cliLog(`serving this page: ${JSON.stringify(serving)}`)
  cliLog(
    serving.includes(mine)
      ? "the build under test is the one answering"
      : "WRONG COPY: measure nothing until this says otherwise"
  )
}
