/**
 * Whether the browser this QA drives is signed in, which is the one thing that
 * cannot be inferred from a screen that failed to draw.
 *
 * A pull request that does not render looks the same for three reasons: no
 * session, GitHub throttling the client, and a fault of ours. This tells the
 * first two apart from the third before any of them is chased.
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/flazouh/gitquiet/pull/74/files"
const session = await withExtension(PAGE, `${import.meta.dir}/../.output/chrome-mv3`)

const seen = await session.evaluate<unknown>(`(() => {
  const meta = document.querySelector('meta[name="user-login"]')
  const said = (document.body ? document.body.innerText : "").replace(/\\s+/g, " ")
  return {
    login: meta ? meta.getAttribute("content") : null,
    title: document.title.slice(0, 100),
    rateLimited: said.includes("rate limit") || said.includes("Whoa there"),
    containers: document.querySelectorAll("diffs-container").length,
    said: said.slice(0, 200)
  }
})()`)

console.log(JSON.stringify({ seen, problems: session.problems().map((p) => (p.split("\n")[0] ?? "").slice(0, 140)) }, null, 2))
session.stop()
