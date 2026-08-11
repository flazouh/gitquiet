/**
 * Loads the built extension into the browser you are already signed into.
 *
 *     bun run reload
 *
 * which builds first and then runs this. Run it after any change; the new build
 * replaces the old one and the tab reloads where it already was.
 *
 * This replaced a preload shim that pasted the content script into the page and
 * pretended to be Chrome. It was a fair imitation and it lied about the two
 * things that matter most: extension storage, which it kept in memory, and
 * extension URLs, which it could not issue at all — so the diff renderer, which
 * is fetched from one, could not be tested through it.
 *
 * `Extensions.loadUnpacked` is a browser command, and ego attaches a page
 * session to anything it does not recognise as one — a page session has no
 * Extensions domain, so the call comes back "Method not available". Passing the
 * session explicitly as null leaves it off and the command lands, returning the
 * id it assigned. Fixed upstream in citrolabs/ego-lite#160; until that ships,
 * the null is what makes this work.
 *
 * Run it again after a rebuild and the new build takes over.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const START = "https://github.com/pulls"

const task = await useOrCreateTaskSpace("test gitquiet extension on real PR")
await takeOverTaskSpace(task.id)

// The dev build is a second extension as far as the browser is concerned, and it
// matches the same pages: left installed, two of these mount into every pull
// request. See scripts/ego-dev.js for where the id comes from.
try {
  const { createHash } = await import("node:crypto")
  const dev = [
    ...createHash("sha256").update(`${EXTENSION}-dev`, "utf8").digest("hex").slice(0, 32)
  ]
    .map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
    .join("")
  await cdp("Extensions.uninstall", { id: dev }, null)
  cliLog("removed the build made by `bun run dev`")
} catch {
  // It was not installed, which is the ordinary case.
}

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
cliLog(`loaded ${id}`)

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
      const root = document.getElementById("gitquiet-root")
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
