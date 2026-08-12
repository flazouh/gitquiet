/**
 * What GitHub's notifications page is made of, so a takeover can find it and a parser can
 * read it.
 *
 *     ego-browser nodejs < scripts/probe-notifications-dom.js
 *
 * Three questions, and the third is the one the whole screen turns on.
 *
 * Which region to stand in. This page is neither the React of a dashboard nor the Turbo of a
 * repository tab, so neither a `react-app` name nor a `turbo-frame` is going to be there.
 *
 * Whether GitHub ever swaps this page in without loading a document, which decides whether the
 * place needs a soft gate at all. Asked by writing a sentinel onto `window`, pressing their own
 * notifications link from another page, and seeing whether the sentinel survives.
 *
 * What a row carries. Specifically whether the state of the thing a Notice is about is on the
 * row or has to be fetched: discussions #15591 and #55098 are both 658 upvotes assuming it is
 * not there. Everything the answers below produced is written up in
 * `docs/spec/notifications.md`, measured on 2026-08-13.
 */

await useOrCreateTaskSpace("probe notifications dom")
await openOrReuseTab("https://github.com/notifications?query=", { wait: true, timeout: 90 })
await new Promise((wake) => setTimeout(wake, 4000))

const region = await js(String.raw`(() => {
  const box = (selector) => {
    const element = document.querySelector(selector)
    if (element === null) return null
    const seen = element.getBoundingClientRect()
    return {
      selector,
      width: Math.round(seen.width),
      height: Math.round(seen.height),
      top: Math.round(seen.top + scrollY)
    }
  }

  /*
   * The candidates worth ruling out as much as the one worth keeping. A pjax container id
   * shared with every repository tab cannot mark this page, and the absence of a React app
   * and a Turbo frame is what says the whole list is in the served document.
   */
  return JSON.stringify({
    body: document.body.className,
    boxes: [
      'main',
      'main#js-repo-pjax-container',
      'div.js-notifications-container',
      'nav.notification-navigation',
      '.js-check-all-container',
      'nav.paginate-container',
      'react-app',
      'turbo-frame',
      'react-partial',
      'include-fragment'
    ].map(box)
  }, null, 1)
})()`)

console.log("region\n" + region)

const rows = await js(String.raw`(() => {
  const rows = [...document.querySelectorAll('li[data-notification-id]')]

  const read = (row) => {
    const link = row.querySelector('a.notification-list-item-link')
    let said = {}
    try {
      said = JSON.parse(link.getAttribute('data-hydro-click')).payload.metadata
    } catch { said = {} }

    /*
     * Their icon with its colour token, which is where the subject's state turned out to be.
     * The shape alone is not enough: 'octicon-git-pull-request-closed' contains
     * 'octicon-git-pull-request', so a match on the word calls every closed one open.
     */
    const icon = row.querySelector('a.notification-list-item-link svg.octicon')

    return {
      id: row.getAttribute('data-notification-id').slice(0, 10),
      classes: [...row.classList].filter((name) => name.startsWith('notification-')),
      icon: icon === null ? null : icon.getAttribute('class').replace(/\s+/g, ' ').trim(),
      reason: said.reason ?? null,
      isPullRequest: said.is_pull_request ?? null,
      isUnread: said.is_unread ?? null,
      groupedBy: said.is_grouped_by ?? null,
      commentType: null,
      /* Recent participants, machines marked by the shape of their link and not by their name. */
      participants: [...row.querySelectorAll('a.avatar')].map((face) => face.getAttribute('href')),
      /* Every write form in the row, which is twelve and not six: their list is drawn twice. */
      forms: [...row.querySelectorAll('form[action^="/notifications/beta/"]')].map((form) =>
        form.getAttribute('action')
      ),
      href: link === null ? null : link.getAttribute('href').split('?')[0]
    }
  }

  return JSON.stringify({ rows: rows.length, first: read(rows[0]), shapes: [...new Set(rows.map((row) => read(row).icon))] }, null, 1)
})()`)

console.log("rows\n" + rows)

/*
 * Their own filter language, asked the questions the five discussions ask of it. `is:open`,
 * `is:merged` and `is:bot` answering zero rather than erroring is the whole of why #15591 and
 * #55098 exist: a reader who tries the obvious thing is told they have no notifications.
 */
for (const query of ["is:unread", "is:read", "is:issue", "is:open", "is:merged", "is:bot"]) {
  await openOrReuseTab(`https://github.com/notifications?query=${encodeURIComponent(query)}`, {
    wait: true,
    timeout: 60
  })
  await new Promise((wake) => setTimeout(wake, 2500))
  const count = await js(String.raw`document.querySelectorAll('li[data-notification-id]').length`)
  console.log(`query ${query} -> ${count} rows`)
}

/*
 * Whether arriving here is a document load. If the sentinel is gone, GitHub loaded a page, and
 * the place needs no soft gate — which is what `COMMIT` records for the same reason.
 */
await openOrReuseTab("https://github.com/pulls", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 3000))
await js(String.raw`window.__probeSentinel = 'here'; 'set'`)
await js(String.raw`(() => {
  const link = document.querySelector('a[href^="/notifications"]')
  if (link === null) return 'no link'
  link.click()
  return 'pressed'
})()`)
await new Promise((wake) => setTimeout(wake, 5000))

const survived = await js(String.raw`JSON.stringify({
  at: location.pathname,
  sentinel: window.__probeSentinel ?? null,
  region: document.querySelector('div.js-notifications-container') !== null
})`)

console.log("navigation\n" + survived)
