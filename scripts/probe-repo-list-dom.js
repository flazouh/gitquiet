/**
 * What a repository's pull request list is made of, so a takeover can find it.
 *
 *     ego-browser nodejs < scripts/probe-repo-list-dom.js
 *
 * Unlike the dashboard this page is Rails-rendered rather than React, so the hooks
 * are different ones: no `react-app` element and no `data-testid` layout. What is
 * wanted is a container that holds the list and nothing else, named by something
 * that does not carry a per-deploy hash.
 */

await useOrCreateTaskSpace("probe repo list dom")
await openOrReuseTab("https://github.com/octo-org/octo-repo/pulls", {
  wait: true,
  timeout: 90
})
await new Promise((wake) => setTimeout(wake, 4000))

const outline = await js(String.raw`(() => {
  const named = (element) => {
    const id = element.id === '' ? '' : '#' + element.id
    const classes = [...element.classList].filter((name) => !/[0-9a-f]{6,}/.test(name))
    const testId = element.getAttribute('data-testid')
    return element.tagName.toLowerCase() + id +
      (classes.length > 0 ? '.' + classes.slice(0, 3).join('.') : '') +
      (testId === null ? '' : '[data-testid=' + testId + ']')
  }

  const walk = (element, depth) => {
    if (depth > 5) return []
    const box = element.getBoundingClientRect()
    const line = '  '.repeat(depth) + named(element) +
      ' ' + Math.round(box.width) + 'x' + Math.round(box.height)
    return [line, ...[...element.children].flatMap((child) => walk(child, depth + 1))]
  }

  const candidates = [
    'turbo-frame#repo-content-turbo-frame',
    '#repo-content-pjax-container',
    '.repository-content',
    'main',
    '[data-turbo-frame]',
    '.js-navigation-container',
    '#js-issues-toolbar',
    'div[aria-label="Issues"]',
    '.Box'
  ].map((selector) => ({
    selector,
    found: document.querySelectorAll(selector).length,
    size: (() => {
      const first = document.querySelector(selector)
      if (first === null) return null
      const box = first.getBoundingClientRect()
      return Math.round(box.width) + 'x' + Math.round(box.height)
    })()
  }))

  return JSON.stringify({
    path: location.pathname,
    candidates,
    outline: walk(document.body, 0).slice(0, 60)
  }, null, 1)
})()`)

cliLog(String(outline))
