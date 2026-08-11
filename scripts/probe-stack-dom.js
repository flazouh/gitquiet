/**
 * Measures the stack the header draws: its direction, its rows and its size.
 *
 *     ego-browser nodejs < scripts/probe-stack-dom.js
 *
 * Reads the chain top to bottom as it is painted, with the step of each row and
 * the box the whole thing occupies, so "which way does it go and how big is it"
 * is answered in pixels rather than from the source.
 */

/** `feat-c -> feat-b -> feat-a -> main`, the top of a stack of three. */
const PR = "https://github.com/flazouh/stack-probe/pull/10"

const task = await useOrCreateTaskSpace("test gitquiet extension on real PR")
await takeOverTaskSpace(task.id)

await gotoAndWait(PR, { timeout: 30, settle: 3 })
await wait(4)

cliLog(
  JSON.stringify(
    JSON.parse(
      await js(String.raw`(() => {
        const root = document.getElementById("gitquiet-root")
        const shadow = root?.shadowRoot ?? root
        if (root === null) return JSON.stringify({ mounted: false })

        const tree = shadow.querySelector('ol[aria-label^="Stack"]')
        if (tree === null) return JSON.stringify({ tree: null, why: "no stack on this pull request" })

        const box = tree.getBoundingClientRect()
        const rows = [...tree.querySelectorAll("li")].map((row) => {
          const at = row.getBoundingClientRect()
          return {
            said: row.textContent,
            tier: row.style.getPropertyValue("--stack-tier"),
            top: Math.round(at.top),
            left: Math.round(at.left),
            width: Math.round(at.width),
            height: Math.round(at.height)
          }
        })

        const chip = [...shadow.querySelectorAll("span")].find((one) =>
          one.getAttribute("aria-label")?.startsWith("Layer ")
        )

        return JSON.stringify({
          label: tree.getAttribute("aria-label"),
          chip: chip === undefined
            ? null
            : { said: chip.textContent, width: Math.round(chip.getBoundingClientRect().width) },
          box: { width: Math.round(box.width), height: Math.round(box.height) },
          rows
        })
      })()`)
    ),
    null,
    1
  )
)

cliLog(`shot: ${JSON.stringify(await captureScreenshot())}`)
await handOffTaskSpace(task.id)
