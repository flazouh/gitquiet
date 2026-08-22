/**
 * How long a pull request takes to appear when the tab has to load a document.
 *
 *     bun run build && ego-browser nodejs < scripts/probe-cold-arrival.js
 *
 * The wait this measures is the one nothing on a page can shorten. A content
 * script cannot run until GitHub's HTML answers — 1.2 to 3.6 seconds on a large
 * pull request — so everything of ours starts after that, unless the service
 * worker started it. See `src/app/onTheWay.ts`.
 *
 * Two builds, alternating which goes first, because the second visit to a pull
 * request is not the same as the first: GitHub's own server answers a page it
 * has just served more quickly, and a run that always measured the same build
 * second would be measuring that. Half the pull requests are read by one build
 * first and half by the other.
 *
 * Each build is its own extension as far as the browser is concerned, since the
 * id comes from the path, so neither one can read what the other kept.
 *
 * Do not believe a reading taken in the first seconds after `Extensions.loadUnpacked`.
 * The wait after each install is there for that reason, and the lesson behind it is
 * written down in `scripts/probe-back-memory.js`.
 */

const MINE = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const BASELINE = "/Users/alex/gq-baseline/.output/chrome-mv3"

/** Pull requests nobody has opened in this browser, which is what makes them cold. */
const FIRST_MINE = [1150, 1100, 1050]
const FIRST_BASELINE = [1300, 1250, 1200]

const REPO = "https://github.com/OpenRouterIncubator/ori/pull/"

/** How much text in our root counts as the card rather than the skeleton. */
const DRAWN = 6000

const task = await useOrCreateTaskSpace("cold arrival")

const install = async (path) => {
  const { id } = await cdp("Extensions.loadUnpacked", { path }, null)
  await openOrReuseTab("https://github.com/pulls", { wait: true, timeout: 60 })
  // Long enough for the worker to have started and the first document to be out
  // of the way. Readings taken before this are about the install, not the build.
  await wait(10)
  return id
}

const remove = async (id) => {
  try {
    await cdp("Extensions.uninstall", { id }, null)
  } catch {
    // Already gone, which is the only other thing that can be true here.
  }
}

/** One arrival: away first, so the navigation is a document load and not a press. */
const arriveAt = async (number) => {
  await openOrReuseTab("https://example.com", { wait: true, timeout: 30 })
  await wait(3)

  const started = Date.now()
  await cdp("Page.navigate", { url: REPO + number }).catch(() => {})

  for (let look = 0; look < 45; look += 1) {
    const chars = await Promise.race([
      js(String.raw`(document.getElementById('gitquiet-root')?.textContent ?? '').length`),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500))
    ]).catch(() => null)
    if (typeof chars === "number" && chars > DRAWN) return Date.now() - started
    await wait(0.25)
  }

  return null
}

const walk = async (path, numbers, name) => {
  const id = await install(path)
  const times = []
  for (const number of numbers) {
    const at = await arriveAt(number)
    times.push({ number, at })
    cliLog(`${name} ${number}: ${at === null ? "never drew" : at + "ms"}`)
  }
  await remove(id)
  return times
}

const said = []
said.push(...(await walk(BASELINE, FIRST_BASELINE, "baseline")))
said.push(...(await walk(MINE, FIRST_BASELINE, "worker  ")))
said.push(...(await walk(MINE, FIRST_MINE, "worker  ")))
said.push(...(await walk(BASELINE, FIRST_MINE, "baseline")))

const middle = (numbers) => {
  const sorted = [...numbers].sort((one, two) => one - two)
  return sorted[Math.floor(sorted.length / 2)] ?? null
}

const half = said.length / 2
cliLog(`baseline median ${middle([...said.slice(0, 3), ...said.slice(9)].map((one) => one.at))}ms`)
cliLog(`worker   median ${middle(said.slice(3, 9).map((one) => one.at))}ms`)
cliLog(`(${half} readings each, halved between which build read a pull request first)`)

await completeTaskSpace(task.id, { keep: false })
