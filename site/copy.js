import { writeFileSync } from "node:fs"

const SITE = "http://localhost:5173"

await useOrCreateTaskSpace("gitquiet landing look")
await openOrReuseTab(SITE, { wait: true, timeout: 30 })
await gotoAndWait(`${SITE}/?copy=${Date.now()}`, { timeout: 30, settle: 3 })

const said = await js(String.raw`(() => {
  const out = []
  const walk = (node) => {
    for (const child of node.children) {
      if (child.hasAttribute('data-live')) {
        out.push('[a live screen]')
        continue
      }
      const own = child.textContent.trim()
      if (child.children.length === 0 || /^(H1|H2|H3|P|A|SPAN|DT|DD|BLOCKQUOTE|FIGCAPTION)$/.test(child.tagName)) {
        if (own.length > 0) out.push(child.tagName.toLowerCase() + '  ' + own.replace(/\s+/g, ' '))
        continue
      }
      walk(child)
    }
  }
  walk(document.body)
  return out
})()`)

writeFileSync("site/copy.txt", said.join("\n") + "\n")
cliLog(`wrote site/copy.txt, ${said.length} lines`)
cliLog(said.join("\n"))
