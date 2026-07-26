import { withExtension } from "./chrome"

/**
 * Checks the built extension on github.com itself, which is the only place two
 * of its claims can be tested: that the bundled font loads under GitHub's
 * Content-Security-Policy, and that the interface — not GitHub's forty-odd
 * stylesheets — decides how the page looks.
 *
 * Run it after `bun run build`:
 *
 *     bun run verify:live
 *
 * The profile is a throwaway, so the visit is unauthenticated and the interface
 * lands on its failure screen. That screen is drawn from the same stylesheet and
 * the same font as everything else, which is what is being asked about.
 */

const FAILURES: ReadonlyArray<readonly [string, (found: Measured) => boolean]> = [
  ["the content script never replaced the page", (found) => !found.tookOverPage],
  ["GitHub stylesheets survived the takeover", (found) => found.githubStylesheetsLeft > 0],
  ["the bundled font did not load", (found) => !found.interUsable],
  ["headings are not rendering in Inter", (found) => found.headingFamily !== "InterVariable"],
  ["something in the interface draws a border", (found) => found.borderedElements > 0],
  ["the page scrolls", (found) => found.pageScrolls]
]

type Measured = {
  readonly tookOverPage: boolean
  readonly githubStylesheetsLeft: number
  readonly interStatus: ReadonlyArray<string>
  readonly interUsable: boolean
  readonly headingFamily: string | null
  readonly headingText: string | null
  readonly bodyBackground: string
  readonly borderedElements: number
  readonly pageScrolls: boolean
}

const session = await withExtension(
  "https://github.com/microsoft/vscode/pull/327442",
  `${import.meta.dir}/../.output/chrome-mv3`
)

const measured = await session.evaluate<Measured>(`
  (() => {
    const faces = [...document.fonts].filter((face) => face.family === "InterVariable")
    const heading = document.querySelector("#githubpro-root h1")
    const bordered = [...document.querySelectorAll("#githubpro-root *")].filter((element) => {
      const style = getComputedStyle(element)
      const sides = ["Top", "Right", "Bottom", "Left"]
      if (sides.every((side) => (parseFloat(style["border" + side + "Width"]) || 0) === 0)) return false
      return sides.some((side) => {
        const colour = style["border" + side + "Color"]
        return colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent"
      })
    })
    return {
      tookOverPage: document.querySelector("#githubpro-root") !== null,
      githubStylesheetsLeft: document.querySelectorAll('link[rel="stylesheet"], style:not([data-githubpro])').length,
      interStatus: faces.map((face) => face.status),
      interUsable: document.fonts.check("13px InterVariable"),
      headingFamily: heading === null ? null : getComputedStyle(heading).fontFamily.split(",")[0],
      headingText: heading?.textContent ?? null,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      borderedElements: bordered.length,
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight
    }
  })()
`)

console.log(JSON.stringify(measured, null, 2))

const shot = `${import.meta.dir}/../.tmp/verify-on-github.png`
await session.screenshot(shot)
console.log(`screenshot: ${shot}`)
session.stop()

const failed = FAILURES.filter(([, holds]) => holds(measured)).map(([reason]) => reason)
if (failed.length > 0) {
  console.error(failed.map((reason) => `✗ ${reason}`).join("\n"))
  process.exit(1)
}
console.log("✓ the interface owns the page, in its own font, with no borders and no scroll")
