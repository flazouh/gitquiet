/**
 * Counts the containers this extension has on their inbox, across six loads of it.
 *
 *     bun run build && ego-browser nodejs < scripts/probe-inbox-mounts.js
 *
 * One is the pass. Written for a reader's report of two: their whole inbox drawn twice in two
 * columns of 612 pixels, because a root is a flex item and the region is a flex row. It was
 * measured four times in six loads there and it is a race, so a single load proves nothing and
 * this asks six times. The Courts come back with it, since the same fault would double those.
 */

const EXTENSION = "/Users/alex/Documents/githubpro-notifications/.output/chrome-mv3"
const LOADS = 6

const task = await useOrCreateTaskSpace("gitquiet inbox double mount")

await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)

const READ = String.raw`(() => {
  const roots = [...document.querySelectorAll("#gitquiet-root")]
  return {
    roots: roots.length,
    for: roots.map((one) => one.getAttribute("data-gitquiet-for")),
    rects: roots.map((one) => {
      const box = one.getBoundingClientRect()
      return [Math.round(box.x), Math.round(box.width)]
    }),
    courts: [...document.querySelectorAll("#gitquiet-root section[aria-label]")].map(
      (one) => one.getAttribute("aria-label")
    ),
    theirRowsShown: [...document.querySelectorAll("li[data-notification-id]")].filter(
      (one) => one.offsetParent !== null
    ).length
  }
})()`

for (let load = 1; load <= LOADS; load += 1) {
  await gotoAndWait("https://github.com/notifications", { timeout: 40, settle: 3 })
  await wait(4)
  cliLog(`load ${load}  ${JSON.stringify(await js(READ))}`)
}
