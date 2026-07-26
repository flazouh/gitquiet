import { withExtension } from "./chrome"

/**
 * Checks the built extension on github.com itself, which is the only place most
 * of its claims can be tested: that the bundled font loads under GitHub's
 * Content-Security-Policy, that the interface — not GitHub's forty-odd
 * stylesheets — decides how the page looks, and that a real pull request
 * actually reads.
 *
 * Run it after `bun run build`:
 *
 *     bun run verify:live
 *     bun run verify:live --pull https://github.com/owner/repo/pull/1
 *
 * The profile is a throwaway, so the visit is signed out and the interface can
 * only reach its failure screen — which still answers the styling questions,
 * since that screen is drawn from the same stylesheet and the same font as
 * everything else. To see the Control Center instead, hand it a signed-in
 * session:
 *
 *     bun run verify:live --cookies /tmp/gh-cookies.json
 *
 * where the file holds what Network.getCookies returns for github.com. Those are
 * live session cookies, so keep them off shared machines and delete them after.
 */

const argumentAfter = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PULL = argumentAfter("--pull") ?? "https://github.com/microsoft/vscode/pull/327442"
const COOKIES = argumentAfter("--cookies")

const FAILURES: ReadonlyArray<readonly [string, (found: Measured) => boolean]> = [
  ["the content script never replaced the page", (found) => !found.tookOverPage],
  ["GitHub stylesheets survived the takeover", (found) => found.githubStylesheetsLeft > 0],
  ["the bundled font did not load", (found) => !found.interUsable],
  ["headings are not rendering in Inter", (found) => found.headingFamily !== "InterVariable"],
  ["something in the interface draws a border", (found) => found.borderedElements > 0],
  ["the page scrolls", (found) => found.pageScrolls]
]

type Measured = {
  readonly screen: "control-center" | "failure" | "loading"
  readonly courts: ReadonlyArray<string>
  readonly rows: number
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

const session = await withExtension(PULL, `${import.meta.dir}/../.output/chrome-mv3`, {
  cookies:
    COOKIES === undefined
      ? undefined
      : ((await Bun.file(COOKIES).json()) as ReadonlyArray<Record<string, unknown>>)
})

const SETTLE_SECONDS = 30

const look = () =>
  session.evaluate<Measured>(`
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
    // A section carries the region role implicitly once it has a name, so the
    // markup is what to look for rather than a role attribute nobody writes.
    const courts = [...document.querySelectorAll("#githubpro-root section[aria-label]")].map(
      (region) => region.getAttribute("aria-label") ?? "?"
    )
    return {
      screen:
        courts.length > 0
          ? "control-center"
          : (heading?.textContent ?? "").startsWith("Something GitHub sends")
            ? "failure"
            : "loading",
      courts,
      rows: document.querySelectorAll("#githubpro-root section[aria-label] button").length,
      tookOverPage: document.querySelector("#githubpro-root") !== null,
      // Only what is outside the interface counts: components inside it inject
      // styles of their own, and those are not GitHub's.
      githubStylesheetsLeft: [
        ...document.querySelectorAll('link[rel="stylesheet"], style:not([data-githubpro])')
      ].filter((sheet) => document.querySelector("#githubpro-root")?.contains(sheet) !== true).length,
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

/**
 * Waits for the interface to stop loading. GitHub's own payloads take as long as
 * they take, and a fixed pause either reports a half-drawn screen or wastes the
 * difference on every run.
 */
const settled = async (): Promise<Measured> => {
  const deadline = Date.now() + SETTLE_SECONDS * 1000
  let seen = await look()
  while (seen.screen === "loading" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    seen = await look()
  }
  return seen
}

const measured = await settled()
console.log(JSON.stringify(measured, null, 2))

const shot = `${import.meta.dir}/../.tmp/verify-on-github.png`
await session.screenshot(shot)
console.log(`screenshot: ${shot}`)

const problems = session.problems()
session.stop()
if (problems.length > 0) {
  console.error(`the page logged ${problems.length} error(s):`)
  console.error(problems.slice(0, 5).join("\n"))
}

const signedIn = COOKIES !== undefined
const failed = [
  ...FAILURES,
  // Signed out there is nothing to read, so the failure screen is the correct
  // outcome. Signed in it means a real pull request did not decode.
  ...(signedIn
    ? ([
        [
          "a real pull request did not reach the Control Center",
          (found: Measured) => found.screen !== "control-center"
        ]
      ] as const)
    : [])
]
  .filter(([, holds]) => holds(measured))
  .map(([reason]) => reason)
if (failed.length > 0) {
  console.error(failed.map((reason) => `✗ ${reason}`).join("\n"))
  process.exit(1)
}
console.log("✓ the interface owns the page, in its own font, with no borders and no scroll")
