import { withExtension } from "./chrome"

/**
 * Checks the built extension on github.com itself, which is the only place most
 * of its claims can be tested.
 *
 * The claims changed shape when the interface stopped replacing the page. It now
 * slots into GitHub's own layout, so what has to hold is the opposite of what
 * used to: their header, their repository nav and their pull request title and
 * tabs are all still there and still working, their conversation is hidden
 * rather than destroyed, and our part of the page is drawn in their typeface,
 * their surfaces and their borders — whichever theme the reader happens to use.
 *
 * Run it after `bun run build`:
 *
 *     bun run verify:live
 *     bun run verify:live --pull https://github.com/owner/repo/pull/1
 *
 * The profile is a throwaway, so the visit is signed out and the interface can
 * only reach its failure screen — which still answers the styling questions,
 * since that screen is drawn from the same stylesheet as everything else. To see
 * the Control Center instead, hand it a signed-in session:
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

type Measured = {
  readonly screen: "control-center" | "failure" | "loading" | "absent"
  readonly courts: ReadonlyArray<string>
  readonly groups: number
  readonly mountedInTheirLayout: boolean
  readonly theirHeaderStands: boolean
  readonly theirPullRequestHeaderStands: boolean
  readonly theirConversationHidden: number
  readonly theirStylesheets: number
  readonly ourFont: string | null
  readonly theirFont: string
  readonly ourSurface: string | null
  readonly theirSurface: string
  readonly ourBorder: string | null
  readonly theirBorder: string
  readonly octicons: number
  readonly ourHeight: number
  readonly viewportHeight: number
}

const FAILURES: ReadonlyArray<readonly [string, (found: Measured) => boolean]> = [
  ["the interface never mounted in GitHub's layout", (found) => !found.mountedInTheirLayout],
  ["GitHub's site header did not survive", (found) => !found.theirHeaderStands],
  [
    "GitHub's pull request header and tabs did not survive",
    (found) => !found.theirPullRequestHeaderStands
  ],
  ["GitHub's own stylesheets were stripped", (found) => found.theirStylesheets < 10],
  ["GitHub's conversation was destroyed rather than hidden", (found) => found.theirConversationHidden === 0],
  ["the interface is not rendering in GitHub's typeface", (found) => found.ourFont !== found.theirFont],
  ["the interface draws no Octicons", (found) => found.octicons === 0]
]

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
    const root = document.querySelector("#githubpro-root")
    const slot = document.querySelector('[class*="PageLayoutContent"]')
    const courts = [...document.querySelectorAll("#githubpro-root section[aria-label]")].map(
      (region) => region.getAttribute("aria-label") ?? "?"
    )
    const failed = (root?.textContent ?? "").startsWith("Something GitHub sends")
    const read = (element, property) =>
      element === null ? null : getComputedStyle(element)[property]
    // The page itself is the fair comparison: whatever theme is on, a card of
    // ours has to be the colour GitHub paints a card.
    const ourBox = document.querySelector("#githubpro-root .Box")

    return {
      screen:
        root === null ? "absent" : courts.length > 0 ? "control-center" : failed ? "failure" : "loading",
      courts,
      groups: document.querySelectorAll("#githubpro-root details").length,
      mountedInTheirLayout: root !== null && slot !== null && slot.contains(root),
      theirHeaderStands: (document.querySelector(".header-wrapper")?.clientHeight ?? 0) > 40,
      theirPullRequestHeaderStands:
        (document.querySelector('[class*="PageLayout-Header"]')?.clientHeight ?? 0) > 40,
      theirConversationHidden: document.querySelectorAll("[data-githubpro-hidden]").length,
      theirStylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      ourFont: read(root, "fontFamily"),
      theirFont: getComputedStyle(document.body).fontFamily,
      ourSurface: read(ourBox, "backgroundColor"),
      theirSurface: getComputedStyle(document.body).backgroundColor,
      ourBorder: read(ourBox, "borderTopColor"),
      theirBorder: getComputedStyle(document.documentElement).getPropertyValue("--borderColor-default").trim(),
      octicons: document.querySelectorAll("#githubpro-root svg.octicon").length,
      ourHeight: Math.round(root?.getBoundingClientRect().height ?? 0),
      viewportHeight: window.innerHeight
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
  while ((seen.screen === "loading" || seen.screen === "absent") && Date.now() < deadline) {
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
        ],
        [
          "the interface is not wearing GitHub's surface colour",
          (found: Measured) => found.ourSurface !== found.theirSurface
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
console.log("✓ the interface sits inside GitHub's page, in GitHub's clothes, with their page intact")
