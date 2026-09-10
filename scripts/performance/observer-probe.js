/** Browser probe for the real mount and link observers. No animation clock. */
export const runObserverProbe = async (api, { nodes, updates = 40 }) => {
  const page = document.implementation.createHTMLDocument("GitQuiet performance fixture")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section></section></div></main>'
  const native = page.querySelector("section")
  native.innerHTML = '<span>native line</span>'.repeat(nodes)
  const marker = page.createElement("span")
  native.append(marker)
  const root = api.interfaceContainer(page)
  const mountStarted = performance.now()
  const takeover = api.takeOverSlot(page, root)
  const mountMs = performance.now() - mountStarted
  if (takeover === null) throw new Error("The fixture did not mount")
  let linkChecks = 0
  const stopLinks = api.protectOwnedLinks(page, (link) => {
    linkChecks++
    return link.getAttribute("href")?.startsWith("/pull/") === true
  })
  const turn = () => new Promise((resolve) => setTimeout(resolve, 0))
  await turn()
  const query = page.querySelector
  const queryAll = page.querySelectorAll
  let queries = 0
  page.querySelector = function (...args) { queries++; return query.apply(this, args) }
  page.querySelectorAll = function (...args) { queries++; return queryAll.apply(this, args) }
  const phases = []
  return (async () => {
    for (const phase of ["screen", "hidden-native", "added-links"]) {
      const samples = []
      queries = 0
      linkChecks = 0
      for (let i = 0; i < updates; i++) {
        const start = performance.now()
        if (phase === "screen") root.textContent = `file ${i}`
        if (phase === "hidden-native") marker.textContent = `line ${i}`
        if (phase === "added-links") {
          const link = page.createElement("a")
          link.href = `/pull/${i}`
          root.append(link)
        }
        await turn()
        samples.push(performance.now() - start)
      }
      const sorted = [...samples].sort((a, b) => a - b)
      phases.push({ phase, documentQueries: queries, linkChecks,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: sorted.at(-1) })
      if (!root.isConnected || root.hasAttribute("hidden") || !native.hasAttribute("hidden"))
        throw new Error(`Visibility invariant failed during ${phase}`)
    }
    const links = [...root.querySelectorAll("a")]
    if (links.length !== updates || links.some(link => link.getAttribute("data-gitquiet-owned-route") !== link.getAttribute("href")))
      throw new Error("An added link lost its route")
    const replacement = page.createElement("div")
    replacement.className = "PageLayoutContent"
    const sibling = page.createElement("p")
    replacement.append(sibling)
    root.parentElement.replaceWith(replacement)
    await turn()
    if (root.parentElement !== replacement || !sibling.hasAttribute("hidden"))
      throw new Error("The screen did not recover after replacement")
    stopLinks()
    takeover.stepAside()
    queries = 0
    page.body.append(page.createElement("aside"))
    await turn()
    if (queries !== 0 || root.isConnected) throw new Error("Teardown kept doing work")
    return { nodes, updates, mountMs, phases, recovered: true, stopped: true }
  })().finally(() => {
    page.querySelector = query
    page.querySelectorAll = queryAll
    stopLinks()
    takeover.stepAside()
  })
}
