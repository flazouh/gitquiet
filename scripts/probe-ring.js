/**
 * Reads whether the focus ring on the strip's button can be seen.
 *
 *     ego-browser nodejs < scripts/probe-ring.js
 *
 * Two reviews disagreed about it, so this asks the page rather than the source:
 * the ring's colour, the fill it is drawn on, and whether they are the same.
 */

const PR = "https://github.com/flazouh/stack-probe/pull/51"

const task = await useOrCreateTaskSpace("ring")
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

        const button = [...shadow.querySelectorAll("button")].find((one) =>
          one.textContent?.includes("Make the stack")
        )
        if (button === undefined) return JSON.stringify({ button: "not on this page" })

        button.focus()
        const style = getComputedStyle(button)
        const link = shadow.querySelector('ol[aria-label*="stack"] a, ol[aria-label*="Stack"] a')
        const linkStyle = link === null ? null : getComputedStyle(link)

        return JSON.stringify({
          pack: getComputedStyle(root).getPropertyValue("--color-accent-emphasis").trim(),
          ring: getComputedStyle(root).getPropertyValue("--color-ink-accent").trim(),
          button: {
            outlineColor: style.outlineColor,
            outlineWidth: style.outlineWidth,
            outlineOffset: style.outlineOffset,
            background: style.backgroundColor,
            same: style.outlineColor === style.backgroundColor
          },
          layerLink: linkStyle === null ? null : {
            outlineColor: linkStyle.outlineColor,
            background: linkStyle.backgroundColor
          }
        })
      })()`)
    ),
    null,
    1
  )
)

cliLog(`shot: ${JSON.stringify(await captureScreenshot())}`)
await handOffTaskSpace(task.id)
