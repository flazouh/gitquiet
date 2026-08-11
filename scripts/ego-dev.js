/**
 * Installs the *dev* build into the browser you are already signed into.
 *
 *     bun run dev        # starts the watchers, then runs this for you
 *     bun run dev:ego    # or on its own, against watchers already running
 *
 * Run it as often as you like. `Extensions.loadUnpacked` on a path that is
 * already installed reloads it and answers with the same id, so there is nothing
 * to ask and nothing to undo — which is the whole of "load it if it isn't
 * loaded". Ego offers no way to ask whether an extension is installed:
 * `Extensions.getStorageItems` wants a browser context and the session this has
 * to use is deliberately without one.
 *
 * The two builds cannot both be installed. Chrome derives an unpacked
 * extension's id from the absolute path it was loaded from, so `.output/chrome-mv3`
 * and `.output/chrome-mv3-dev` are two different extensions to it, both matching
 * github.com, both mounting a #gitquiet-root into the same page. The id is a
 * hash of the path and nothing else, so it can be worked out here rather than
 * remembered, and the other build uninstalled by name before this one goes in.
 *
 * The null session on `Extensions.loadUnpacked` is not optional; the note in
 * scripts/ego-extension.js explains why.
 */

const { createHash } = await import("node:crypto")

const ROOT = "/Users/alex/Documents/githubpro"
const START = "https://github.com/pulls"

/**
 * The id Chrome gives an extension loaded from a folder: the first sixteen bytes
 * of the path's SHA-256, each nibble read as a letter from `a`. Verified against
 * both of this repo's outputs, which load as ablmc… and ejlmp… respectively.
 */
const idFor = (path) =>
  [...createHash("sha256").update(path, "utf8").digest("hex").slice(0, 32)]
    .map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
    .join("")

const task = await useOrCreateTaskSpace("develop gitquiet against a real PR")
await takeOverTaskSpace(task.id)

try {
  await cdp("Extensions.uninstall", { id: idFor(`${ROOT}/.output/chrome-mv3`) }, null)
  cliLog("removed the build made by `bun run reload`")
} catch {
  // It was not installed, which is the ordinary case.
}

const path = `${ROOT}/.output/chrome-mv3-dev`
const { id } = await cdp("Extensions.loadUnpacked", { path }, null)
cliLog(`loaded ${id}`)

// Reload wherever the tab already is, so this can be run mid-review without
// losing the pull request being looked at.
const here = (await pageInfo()).url
await gotoAndWait(here.startsWith("https://github.com/") ? here : START, {
  timeout: 30,
  settle: 3
})

// Waited for rather than counted to. An extension that has just been installed
// takes a moment to have its content script registered, and a fixed three seconds
// reported an empty page often enough to look like a failure when it was a race.
try {
  await waitForElement("#gitquiet-root", { timeout: 20 })
} catch {
  cliLog("no #gitquiet-root after 20s — see the page's console")
}

cliLog(
  JSON.stringify(
    await js(String.raw`(() => {
      const roots = document.querySelectorAll("#gitquiet-root")
      return {
        url: location.pathname,
        roots: roots.length,
        heading: roots[0]?.querySelector("h2")?.textContent ?? null
      }
    })()`),
    null,
    1
  )
)

await handOffTaskSpace(task.id)
cliLog("dev build installed — save a file in src/ and the page follows")
