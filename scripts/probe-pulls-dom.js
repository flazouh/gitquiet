/**
 * What github.com/pulls is made of, so the interface can be put in the right
 * place on it.
 *
 *     ego-browser nodejs < scripts/probe-pulls-dom.js
 *
 * Primer's class names carry a per-deploy hash, so the selectors this page needs
 * cannot be guessed from the pull request page's — they have to be read off the
 * live document, signed in, which is the only state the dashboard renders in.
 */

const PAGE = "https://github.com/pulls"

await useOrCreateTaskSpace("probe pulls dom")
await openOrReuseTab(PAGE, { wait: true, timeout: 60 })

const who = await js(String.raw`document.querySelector('meta[name="user-login"]')?.content ?? null`)
if (who === null) {
  cliLog("Signed out. The dashboard does not render at all; sign in first.")
} else {
  cliLog(`Signed in as ${who}`)

  const tree = await js(String.raw`
    const named = (element) => {
      const parts = [element.tagName.toLowerCase()]
      if (element.id) parts.push('#' + element.id)
      for (const name of element.classList) {
        // Primer's hash is the tail; the stable part is what a selector can use.
        parts.push('.' + name)
      }
      for (const attribute of ['app-name', 'aria-label', 'role', 'data-testid']) {
        const value = element.getAttribute(attribute)
        if (value) parts.push('[' + attribute + '="' + value + '"]')
      }
      return parts.join('')
    }

    const outline = (element, depth, limit) => {
      if (depth > limit) return []
      const rect = element.getBoundingClientRect()
      const line = '  '.repeat(depth) + named(element) +
        '  (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ')'
      const children = [...element.children]
        .filter((child) => !['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(child.tagName))
      return [line, ...children.flatMap((child) => outline(child, depth + 1, limit))]
    }

    return outline(document.querySelector('main') ?? document.body, 0, 7).join('\n')
  `)

  cliLog(tree)
}
