/**
 * Checks the two situations a walk of the panel cannot see by reading alone.
 *
 *     ego-browser nodejs < scripts/probe-owed-press.js
 *
 * The done state, which only appears on a pull request that owes nothing at all,
 * and the delta row's press, which opens the oldest commit the reader has not
 * seen. Delete the "up to date before merging" ruleset first: while it is on,
 * every branch is behind and no pull request in the scratch repo owes nothing.
 */

const REPO = "https://github.com/flazouh/ghpro-scratch/pull"

const task = await useOrCreateTaskSpace("test gitquiet extension on real PR")
await takeOverTaskSpace(task.id)

const owed = String.raw`(() => {
  const root = document.getElementById("gitquiet-root")
  const shadow = root?.shadowRoot ?? root
  return [...(shadow?.querySelectorAll("section") ?? [])].find(
    (one) => one.querySelector("h2")?.textContent === "What is owed"
  )
})()`

await gotoAndWait(`${REPO}/9`, { timeout: 30, settle: 3 })
await wait(4)
cliLog(
  `\n### the done state, on a pull request that owes nothing\n${
    await js(String.raw`(() => {
      const panel = ${owed}
      if (panel === undefined) return "no panel"
      return JSON.stringify({
        said: panel.querySelector("p")?.textContent ?? null,
        courts: [...panel.querySelectorAll("h3")].map((head) => head.textContent),
        folded: [...panel.querySelectorAll("h3 button")].map(
          (press) => press.getAttribute("aria-expanded")
        )
      }, null, 1)
    })()`)
  }`
)

await gotoAndWait(`${REPO}/6`, { timeout: 30, settle: 3 })
await wait(4)

const pressed = await js(String.raw`(() => {
  const panel = ${owed}
  const row = [...(panel?.querySelectorAll("li button") ?? [])].find(
    // Two spans with no space between them, so the joined text has none either.
    (one) => one.textContent?.includes("since you last reviewed")
  )
  if (row === undefined) return "no pressable delta row"
  row.click()
  return "pressed"
})()`)

await wait(3)
cliLog(
  `\n### pressing the delta row (${pressed})\n${
    await js(String.raw`(() => {
      const root = document.getElementById("gitquiet-root")
      const shadow = root?.shadowRoot ?? root
      // Whatever the reading pane came to show, said as its own heading.
      const heads = [...(shadow?.querySelectorAll("h1, h2, h3") ?? [])]
        .map((one) => one.textContent?.trim())
        .filter((one) => one !== undefined && one !== "")
      return JSON.stringify({ url: location.pathname, heads: heads.slice(0, 12) }, null, 1)
    })()`)
  }`
)

cliLog(`shot: ${JSON.stringify(await captureScreenshot())}`)

await handOffTaskSpace(task.id)
