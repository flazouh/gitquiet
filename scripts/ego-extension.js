/**
 * Loads the built extension into the browser you are already signed into.
 *
 *     bun run build && ego-browser nodejs < scripts/ego-extension.js
 *
 * This replaced a preload shim that pasted the content script into the page and
 * pretended to be Chrome. It was a fair imitation and it lied about the two
 * things that matter most: extension storage, which it kept in memory, and
 * extension URLs, which it could not issue at all — so the diff renderer, which
 * is fetched from one, could not be tested through it.
 *
 * ego's `cdp` helper speaks to a page. `Extensions.loadUnpacked` is a browser
 * command, which is what `sendCDPMessage` sends: a raw protocol message on the
 * browser connection. It replies nothing and reports nothing; whether it worked
 * is answered by the page, below.
 *
 * Run it again after a rebuild and the new build takes over.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const START = "https://github.com/pulls"

const task = await useOrCreateTaskSpace("test githubpro extension on real PR")
await takeOverTaskSpace(task.id)

await sendCDPMessage(
  JSON.stringify({
    id: 1,
    method: "Extensions.loadUnpacked",
    params: { path: EXTENSION }
  })
)
await wait(2)

// Reload wherever the tab already is, so this can be run mid-review without
// losing the pull request being looked at.
const here = (await pageInfo()).url
await gotoAndWait(here.startsWith("https://github.com/") ? here : START, {
  timeout: 30,
  settle: 3
})
await wait(3)

cliLog(
  JSON.stringify(
    await js(String.raw`(() => {
      const root = document.getElementById("githubpro-root")
      return {
        url: location.pathname,
        mounted: root !== null,
        heading: root?.querySelector("h2")?.textContent ?? null
      }
    })()`),
    null,
    1
  )
)

await handOffTaskSpace(task.id)
cliLog("the extension is installed in this browser — open any pull request")
