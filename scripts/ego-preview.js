/**
 * Runs the built extension inside the browser you are already signed into.
 *
 *     bun run build && ego-browser nodejs < scripts/ego-preview.js
 *
 * ego-browser has no extension loader, so this is not the extension: it is the
 * same bundle, evaluated in the page with the two extension APIs it reaches for
 * standing in. Corrections therefore last as long as the tab does. Everything
 * about how the interface looks and reads is real, which is what a preview is
 * for; the packaged extension is what `bun run verify:live` checks.
 *
 * Registered with Page.addScriptToEvaluateOnNewDocument rather than evaluated
 * once, so it survives navigation — click from one pull request to the next and
 * the interface is there, as it would be if it were installed.
 */

const fs = await import("node:fs")

// Absolute, because ego evaluates this script rather than importing it: there is
// no module URL here to resolve a relative path against.
const OUTPUT = "/Users/alex/Documents/githubpro/.output/chrome-mv3/content-scripts/"
const START = "https://github.com/pulls"

const css = fs.readFileSync(OUTPUT + "pull-request.css", "utf8")
const bundle = fs.readFileSync(OUTPUT + "pull-request.js", "utf8")

/**
 * The bundle, wrapped in everything Chrome would otherwise have done for it:
 * deciding which pages it runs on, waiting for a document to exist, and putting
 * it back after GitHub navigates without reloading.
 */
const preload = `
(() => {
  if (window.top !== window || location.host !== "github.com") return

  const kept = {}
  const api = {
    runtime: {
      id: "githubpro-preview",
      getURL: (path) => location.origin + path,
      onMessage: { addListener() {}, removeListener() {} },
      sendMessage: async () => undefined
    },
    storage: {
      local: {
        get: async () => kept,
        set: async (entries) => { Object.assign(kept, entries) }
      },
      onChanged: { addListener() {}, removeListener() {} }
    }
  }
  globalThis.browser = api
  globalThis.chrome = api

  const dressed = () => {
    if (document.querySelector("style[data-githubpro-preview]") !== null) return
    const style = document.createElement("style")
    style.setAttribute("data-githubpro-preview", "")
    style.textContent = ${JSON.stringify(css)}
    document.head.append(style)
  }

  const run = () => { ${bundle} }

  const conversation = () => /^\\/[^/]+\\/[^/]+\\/pull\\/\\d+\\/?$/.test(location.pathname)

  const start = () => {
    if (!conversation()) return
    dressed()
    run()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true })
  } else {
    start()
  }

  // GitHub moves between pull requests without loading a document, which a
  // preload script only fires on. Cheaper than intercepting their router, and
  // it cannot miss a route we did not know about.
  setInterval(() => {
    if (conversation() && document.getElementById("githubpro-root") === null) start()
  }, 1000)
})()
`

const task = await useOrCreateTaskSpace("test githubpro extension on real PR")
await takeOverTaskSpace(task.id)

const tab = (await ensureRealTab()) ?? (await openOrReuseTab(START, { wait: true, timeout: 30 }))
await cdp("Page.enable")
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: preload })

const here = (await pageInfo()).url
await gotoAndWait(here.startsWith("https://github.com/") ? here : START, {
  timeout: 30,
  settle: 3
})

cliLog(
  JSON.stringify(
    await js(String.raw`(() => {
      const root = document.querySelector("#githubpro-root")
      return {
        url: location.pathname,
        mounted: root !== null,
        courts: [...document.querySelectorAll("#githubpro-root section[aria-label]")].map((s) =>
          s.getAttribute("aria-label")
        ),
        needsYou: document.querySelector("#githubpro-root h2")?.textContent ?? null
      }
    })()`),
    null,
    1
  )
)
cliLog("preview armed: every github.com pull request in this space now renders the interface")
