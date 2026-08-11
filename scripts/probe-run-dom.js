/**
 * Reads a workflow run's page off a live GitHub, for the place the interface stands in
 * and for the routes it is allowed to ask.
 *
 *     ego-browser nodejs < scripts/probe-run-dom.js
 *
 * Three questions, and none is answerable from memory. Which region their router renders a
 * run into, so a `Place` names a box that is really there. What their own page asks for
 * while it loads, because a run is keyed by a run id and every read this gateway already
 * has is keyed by a pull request and a head SHA. And whether the jobs, the steps and the
 * annotations arrive as JSON or only as markup.
 *
 * Read off their own traffic the way `src/github/persisted.ts` reads a query hash:
 * `performance.getEntriesByType("resource")` hands back every URL the page fetched, so the
 * routes come from what GitHub does rather than from a guess.
 *
 * The answers as recorded, against run 30866145080 on 2026-08-04.
 *
 * The place: `turbo-frame#repo-content-turbo-frame`, 1512 by 2242 at top 100. No
 * `#repo-content-pjax-container` and no `react-app`. A run is a server-rendered Turbo page
 * with `react-partial` islands, so the gate waits on the frame, not on a React app name.
 *
 * The run page's own HTML carries almost everything, and it is one fetch:
 *
 *   - `<run-summary>` holds the workflow name, the run number, the commit title, the
 *     trigger, the actor, the pull request, the branch, Status, Total duration, Artifacts.
 *   - `<streaming-graph-job>`, one per job, holds `data-job-id` (the name), the conclusion
 *     as an `aria-label` on its icon ("failed: ", "completed successfully: "), the duration
 *     as text, and an anchor to `/actions/runs/{id}/job/{checkRunId}`.
 *   - `<annotation-message>`, 15 of them here, the same custom element
 *     `src/github/annotations.ts` already parses off the Checks tab.
 *   - `<job-summaries data-channel>` base64-decodes to `{"c":"check_suites:83699982764"}`,
 *     so a run's check suite id is readable without a second ask.
 *
 * The routes their page uses, all JSON unless said:
 *
 *   - `/actions/runs/{id}/navigation_partial?selected_tab=summary`: every job as
 *     `{ id, displayName, status, conclusion, href }`, where `id` is the check run id.
 *     Redundant against the HTML above, and cheaper to poll.
 *   - `/actions/runs/{id}/job_groups_batch?attempt=1`: the same, one group at a time,
 *     with `totalCount` and `hasMore`.
 *   - `/actions/runs/{id}/jobs/{internalJobId}/steps?change_id=0`: the steps, each with
 *     `number`, `name`, `status`, `conclusion`, `started_at`, `completed_at`, and a
 *     `log_url` already pointing at `/commit/{sha}/checks/{checkRunId}/logs/{number}`.
 *     Needs `Accept: application/json`; answers 400 for `text/html`.
 *   - `/actions/runs/{id}/failed_jobs`: HTML, the failed job names and nothing else.
 *   - `/actions/runs/{id}/job_summary_partial`: 404 without the params their page holds.
 *
 * The one thing not in the run page: the `internalJobId` the steps route wants. The
 * `include-fragment src=".../jobs/{internalJobId}/downstream_list"` elements carry twelve of
 * them for twelve jobs, but **not in the jobs' order** (fragment 73783363310 is second and
 * belongs to the fifth job, `integration-test`), so they cannot be paired by position. The
 * path that works is the one `src/github/steps.ts` already walks: fetch the job page HTML
 * for a check run id, read the internal job id out of it, then ask for steps. One extra
 * fetch per job, and only failed jobs need it.
 *
 * So the whole of a run screen is: one HTML fetch for the summary, the jobs and the
 * annotations, then per failed job a job page, its steps, and the failing step's log. The
 * last two reads are `gateway.steps` and `gateway.log`, which are built and in use.
 */

await useOrCreateTaskSpace("probe run dom")
await openOrReuseTab(
  "https://github.com/octo-org/octo-repo/actions/runs/30866145080",
  { wait: true, timeout: 60 }
)
await wait(6)

console.log(
  await js(String.raw`
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }
    }

    const regions = Object.fromEntries(
      [
        '#repo-content-pjax-container',
        'turbo-frame#repo-content-turbo-frame',
        'react-app',
        '[data-testid="workflow-run-graph"]',
        '.js-check-step-logs'
      ].map((sel) => [sel, box(sel)])
    )

    // Their own asks, minus the things every page fetches. A route is worth recording
    // when it carries this run's id or names jobs, steps, annotations or logs.
    const asked = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('github.com') || name.includes('githubusercontent'))
      .filter((name) => !/\.(js|css|woff2?|png|svg|jpg|gif|ico)(\?|$)/.test(name))
      .map((name) => name.replace('https://github.com', ''))

    const embedded = [...document.querySelectorAll('script[type="application/json"]')]
      .map((tag) => ({
        target: tag.getAttribute('data-target'),
        id: tag.id || null,
        head: (tag.textContent ?? '').slice(0, 160)
      }))

    return JSON.stringify({
      regions,
      appName: document.querySelector('react-app')?.getAttribute('app-name') ?? null,
      asked: [...new Set(asked)],
      embedded
    }, null, 1)
  `)
)
