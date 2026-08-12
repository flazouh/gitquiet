/**
 * Checks the built extension on GitHub's own notifications page, which is the only place
 * this screen's claims can be tested.
 *
 *     bun run build && ego-browser nodejs < scripts/verify-notifications.js
 *
 * What has to hold is the same set of things `scripts/verify-on-github.ts` asks of a pull
 * request, asked of the inbox instead: their header and their bell are still there and still
 * theirs, their rows are hidden rather than destroyed, our screen is standing inside their
 * layout, and it takes its surfaces from whichever theme the reader happens to use. The Courts
 * and the row count are read off the page rather than asserted here, because what the inbox
 * holds on any day is the reader's business.
 *
 * The typeface is read for the record and not as a test. This interface ships Inter Variable
 * and GitHub's body is Mona Sans VF, measured the same on the inbox and on
 * /oven-sh/bun/issues/23014, a screen that has stood for months, so the two names differing is
 * how every page here already looks rather than a fault of this one.
 */

const EXTENSION = "/Users/alex/Documents/githubpro-notifications/.output/chrome-mv3"
const INBOX = "https://github.com/notifications"

const task = await useOrCreateTaskSpace("verify gitquiet on the notifications page")
await takeOverTaskSpace(task.id)

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
cliLog(`loaded ${id}`)

await gotoAndWait(INBOX, { timeout: 30, settle: 3 })
await wait(3)

cliLog(
  JSON.stringify(
    await js(String.raw`(() => {
      const root = document.getElementById("gitquiet-root")
      const region = document.querySelector("div.js-notifications-container")
      const seen = (element) => {
        for (let at = element; at !== null; at = at.parentElement) {
          if (at.hasAttribute("hidden")) return false
          if (getComputedStyle(at).display === "none") return false
        }
        return true
      }

      const courts = [...document.querySelectorAll("#gitquiet-root section[aria-label]")].map(
        (one) => ({
          court: one.getAttribute("aria-label"),
          rows: one.querySelectorAll("li").length
        })
      )

      const theirRows = [...document.querySelectorAll("li[data-notification-id]")]

      return {
        url: location.pathname,
        page: document.documentElement.getAttribute("data-gitquiet-page"),
        mounted: root !== null,
        insideTheirRegion: region !== null && region.contains(root),
        theirHeaderStands: seen(document.querySelector("header.AppHeader") ?? document.body),
        theirBellStands: document.querySelector('a[href="/notifications"]') !== null,
        theirRowsServed: theirRows.length,
        theirRowsHidden: theirRows.filter((one) => !seen(one)).length,
        theirPaneHidden: (() => {
          const pane = document.querySelector("nav.notification-navigation, .js-notification-inbox-filters")
          return pane === null ? null : !seen(pane)
        })(),
        courts,
        presses: document.querySelectorAll('#gitquiet-root button[aria-label="Done"]').length,
        octicons: document.querySelectorAll("#gitquiet-root svg.octicon").length,
        ourFont: root === null ? null : getComputedStyle(root).fontFamily.split(",")[0],
        theirFont: getComputedStyle(document.body).fontFamily.split(",")[0],
        ourSurface: root === null ? null : getComputedStyle(root).backgroundColor,
        theirSurface: getComputedStyle(document.body).backgroundColor
      }
    })()`),
    null,
    1
  )
)

await handOffTaskSpace(task.id)
