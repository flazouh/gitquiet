/**
 * What it costs a row to say how big its pull request is.
 *
 *     ego-browser nodejs < scripts/probe-list-size.js
 *
 * Asked and answered, none of them counting a line: the listing payload, the
 * deferred batch that brings the checks, the merge box that brings the branch
 * names, `files_summary` (conversation channels, despite the name), the header
 * route, and the hovercard. `/changes` counts them in `diffSummaries` and weighs
 * 749 kilobytes for a large pull request, whatever `bytes` and `ctx` are set to.
 *
 * This round: GitHub's own conversation page shows a file count on its Files tab
 * before anything has read a diff, so something cheap knows at least that much.
 * Where, exactly — and whether the patch's own length can stand in for a size.
 */

const ASK = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

const REPO = "octo-org/octo-repo"
const NUMBER = 1567

await useOrCreateTaskSpace("probe repo list")
await openOrReuseTab("https://github.com/", { wait: true, timeout: 60 })
await new Promise((wake) => setTimeout(wake, 2000))

const probe = async (label, expression) => {
  cliLog(`\n=== ${label} ===`)
  try {
    cliLog(String(await js(expression)))
  } catch (error) {
    cliLog(`failed: ${String(error).slice(0, 300)}`)
  }
}

// Everything the header route says, since it is five kilobytes and already read
// for every card: any number in here is a number a row could have for free.
await probe(
  "every number the header route carries",
  String.raw`(async () => {
    const answer = await fetch('https://github.com/${REPO}/pull/${NUMBER}/page_data/header', { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
    if (!answer.ok) return JSON.stringify({ status: answer.status })
    const body = await answer.json()

    const numbers = (thing, depth = 0, path = '') => {
      const found = []
      if (thing === null || typeof thing !== 'object' || depth > 6) return found
      for (const [key, value] of Object.entries(thing)) {
        const at = path === '' ? key : path + '.' + key
        if (typeof value === 'number') found.push([at, value])
        else if (Array.isArray(value)) found.push([at + '[]', value.length])
        else found.push(...numbers(value, depth + 1, at))
      }
      return found
    }

    return JSON.stringify(numbers(body), null, 1)
  })()`
)

// Route names GitHub might answer to. Cheap to ask, and one of them being small
// and honest decides the whole feature.
await probe(
  "which other routes answer, and what they weigh",
  String.raw`(async () => {
    const names = [
      '/page_data/files',
      '/page_data/files_summary',
      '/page_data/diff_summaries',
      '/page_data/changed_files',
      '/page_data/changes_summary',
      '/page_data/diffstat',
      '/page_data/summary',
      '/page_data/commits',
      '/page_data/conversation',
      '/page_data/tabs',
      '/page_data/counts',
      '/files_summary?diff=unified',
      '/changes?summary=1',
      '/changes?diff_summaries_only=1'
    ]

    const ask = async (route) => {
      const started = performance.now()
      try {
        const answer = await fetch('https://github.com/${REPO}/pull/${NUMBER}' + route, { headers: ${JSON.stringify(ASK)}, credentials: 'include' })
        const took = Math.round(performance.now() - started)
        if (!answer.ok) return { route, status: answer.status, took }
        const text = await answer.text()
        return {
          route,
          took,
          kilobytes: Math.round(text.length / 1024),
          counts: /linesAdded|linesDeleted|changedFiles|filesChanged/.test(text)
        }
      } catch (error) {
        return { route, failed: String(error).slice(0, 80) }
      }
    }

    const found = []
    for (const name of names) found.push(await ask(name))
    return JSON.stringify(found, null, 1)
  })()`
)

// The patch itself: not a count of lines, but its length is a size, and a HEAD
// request for it costs nothing at all.
await probe(
  "what the patch's own length costs",
  String.raw`(async () => {
    const started = performance.now()
    try {
      const head = await fetch('https://github.com/${REPO}/pull/${NUMBER}.diff', { method: 'HEAD', credentials: 'include' })
      const took = Math.round(performance.now() - started)
      return JSON.stringify({
        status: head.status,
        took,
        length: head.headers.get('content-length'),
        type: head.headers.get('content-type'),
        redirected: head.redirected,
        url: head.url.slice(0, 120)
      })
    } catch (error) {
      return JSON.stringify({ failed: String(error).slice(0, 160) })
    }
  })()`
)
