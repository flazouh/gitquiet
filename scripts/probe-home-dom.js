/**
 * What github.com/ is made of, so Home can be put in the right place on it.
 *
 *     ego-browser nodejs < scripts/probe-home-dom.js
 *
 * The third of these, and the awkward one. The two lists each had a single region
 * that was the whole of the page being replaced; this page is a stack of modules —
 * a chat input, agent sessions, pull requests, issues — and only some of them are
 * ours to take. So this asks three questions rather than one:
 *
 *   1. Which region holds the modules, and is there one that holds all of them and
 *      nothing else.
 *   2. Whether the Copilot input is inside that region or above it. If it is inside,
 *      taking the region takes the input with it and no rule is needed; if it is
 *      above, hiding it is a band of its own.
 *   3. What marks this page and no other, for the soft gate. `/` is the address
 *      GitHub soft-navigates to most often, so a rule keyed on the wrong thing
 *      would blank whatever page the reader is leaving.
 *
 * `/dashboard` is checked as well, because it is GitHub's own alias for this page and
 * `pages.ts` should only claim both if both render the same regions.
 *
 * One precondition, learned the hard way. Every module on this page is a
 * `react-partial` that hydrates from a painted frame, so in a window the operating
 * system is not showing, all of them sit at "Loading" and every box measures 0x0 —
 * `visibilityState` stays `hidden` even for the active tab, and faking it does not
 * help because the hydration waits on paint rather than on the flag. The ego-browser
 * window has to be visible on screen while this runs. It says so and stops rather
 * than printing a page of zeroes.
 */

const HOME = "https://github.com/"
const ALIAS = "https://github.com/dashboard"

/** Everything about the page a Place has to be written from, read in one go. */
const READ = String.raw`(() => {
  const named = (element) => {
    const parts = [element.tagName.toLowerCase()]
    if (element.id) parts.push('#' + element.id)
    for (const name of element.classList) parts.push('.' + name)
    for (const attribute of ['app-name', 'aria-label', 'role', 'data-testid', 'data-target']) {
      const value = element.getAttribute(attribute)
      if (value) parts.push('[' + attribute + '="' + value + '"]')
    }
    return parts.join('')
  }

  const box = (element) => {
    const rect = element.getBoundingClientRect()
    return Math.round(rect.width) + 'x' + Math.round(rect.height)
  }

  const outline = (element, depth, limit) => {
    if (element === null || depth > limit) return []
    const line = '  '.repeat(depth) + named(element) + '  (' + box(element) + ')'
    const children = [...element.children].filter(
      (child) => !['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'SVG'].includes(child.tagName)
    )
    return [line, ...children.flatMap((child) => outline(child, depth + 1, limit))]
  }

  /** The chain from an element up to main, which is what says whether it is inside a region. */
  const upwards = (element) => {
    const chain = []
    for (let at = element; at !== null && at !== document.body; at = at.parentElement) {
      chain.push(named(at) + ' (' + box(at) + ')')
    }
    return chain
  }

  const main = document.querySelector('main') ?? document.body

  /*
   * The input the screenshot opens on. Matched on what it is rather than on its
   * words, because the placeholder is copy and copy changes: a textarea or a
   * contenteditable is what a chat entry point is made of either way.
   */
  const asking = [
    ...document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')
  ].map((element) => ({
    what: named(element),
    placeholder:
      element.getAttribute('placeholder') ?? element.getAttribute('aria-label') ?? '',
    inMain: main.contains(element),
    chain: upwards(element)
  }))

  /* Every candidate for a region: something named in a way that survives a deploy. */
  const candidates = [
    ...document.querySelectorAll('[data-testid], react-app[app-name], [id], turbo-frame')
  ]
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 300 && rect.height > 200
    })
    .map((element) => ({
      selector: named(element),
      box: box(element),
      depth: (() => {
        let depth = 0
        for (let at = element; at !== null; at = at.parentElement) depth += 1
        return depth
      })(),
      inMain: main.contains(element)
    }))

  /*
   * The modules, by the name GitHub gives each one. These are the hooks worth having:
   * a partial's name carries no per-deploy hash, says what the module is, and tells a
   * band apart from a region — the chat input is its own partial beside the lists
   * rather than inside them.
   */
  const partials = [...document.querySelectorAll('react-partial')].map((element) => ({
    name: element.getAttribute('partial-name'),
    box: box(element),
    inMain: main.contains(element),
    hydrated: element.querySelector('[data-target="react-partial.reactRoot"]')?.children.length > 0,
    chain: upwards(element)
  }))

  return {
    url: location.href,
    login: document.querySelector('meta[name="user-login"]')?.content ?? null,
    painted: {
      visibility: document.visibilityState,
      main: box(main),
      /* What a page still at "Loading" says, which is how this is recognised. */
      loading: /\bLoading\b/.test(document.body.innerText)
    },
    partials,
    /* What tells this page from every other, in the order a gate would try them. */
    marks: {
      appNames: [...document.querySelectorAll('react-app')].map((one) =>
        one.getAttribute('app-name')
      ),
      routePattern: document.querySelector('meta[name="route-pattern"]')?.content ?? null,
      routeController: document.querySelector('meta[name="route-controller"]')?.content ?? null,
      routeAction: document.querySelector('meta[name="route-action"]')?.content ?? null,
      bodyClass: document.body.className
    },
    asking,
    candidates,
    outline: outline(main, 0, 6).join('\n')
  }
})()`

await useOrCreateTaskSpace("probe home dom")

for (const page of [HOME, ALIAS]) {
  await openOrReuseTab(page, { wait: true, timeout: 90 })

  /*
   * Waited for by layout rather than by a clock. The modules arrive after the Rails
   * shell, and a region measured before they land reports a height that is not the
   * one a gate will see.
   */
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const height = await js(
      String.raw`Math.round(document.querySelector('main')?.getBoundingClientRect().height ?? 0)`
    )
    if (height > 200) break
    await new Promise((wake) => setTimeout(wake, 1000))
  }

  const found = await js(READ)

  if (found.login !== null && found.painted.main === "0x0") {
    cliLog(`${found.url}: nothing is laid out — main is 0x0, visibility is ` +
      `${found.painted.visibility}${found.painted.loading ? ', modules still say "Loading"' : ''}.`)
    cliLog("Bring the ego-browser window to the front and run this again.")
    continue
  }

  cliLog("=".repeat(72))
  cliLog(found.url)

  if (found.login === null) {
    cliLog("Signed out. This page is a marketing page when signed out; sign in first.")
    continue
  }

  cliLog(`Signed in as ${found.login}`)
  cliLog("\n-- What marks this page --")
  cliLog(JSON.stringify(found.marks, null, 2))

  cliLog("\n-- Modules, by the name GitHub gives each --")
  for (const one of found.partials) {
    cliLog(
      `${one.hydrated ? "hydrated" : "EMPTY   "} ${one.inMain ? "in main " : "outside "}` +
        `${one.box}  react-partial[partial-name="${one.name}"]`
    )
    for (const step of one.chain) cliLog("    " + step)
  }

  cliLog("\n-- Text inputs, and whether they are inside main --")
  for (const one of found.asking) {
    cliLog(`${one.inMain ? "inside" : "OUTSIDE"} main: ${one.what}  ${one.placeholder}`)
    for (const step of one.chain) cliLog("    " + step)
  }

  cliLog("\n-- Region candidates, shallowest first --")
  for (const one of [...found.candidates].sort((a, b) => a.depth - b.depth)) {
    cliLog(`d${one.depth} ${one.inMain ? "in main " : "outside "} ${one.box}  ${one.selector}`)
  }

  cliLog("\n-- Outline --")
  cliLog(found.outline)
}
