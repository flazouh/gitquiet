/**
 * A job's steps, as GitHub's own view reads them.
 *
 *     ego-browser nodejs < scripts/probe-check-steps.js
 *
 * The native Actions view lists a job as a run of foldable steps with a duration
 * on the right, and it reads that list from a route of its own:
 *
 *     /{owner}/{repo}/actions/runs/{run}/jobs/{job}/steps   (Accept: application/json)
 *
 * Two things this settled, both of which the reader in `steps.ts` depends on.
 * The route is keyed by an internal job number, not the check run id our links
 * carry — asked with the latter it answers 404 — and that number appears in the
 * job page's own markup as `/jobs/{number}/steps`, which is where we find it.
 * Every step also carries the log route we already fetch, keyed by step number.
 *
 * Printed whole, because the answer is what the fixture is made of. Point it at
 * a run with a failing job to see how a failure and an unrun step come back.
 */

const RUN = "/octo-org/octo-repo/actions/runs/30507091863"
/** The pull request's Checks tab, which is where every job of the run is linked. */
const PULL = "https://github.com/octo-org/octo-repo/pull/1555/checks"

await useOrCreateTaskSpace("probe check steps")
await openOrReuseTab(PULL, { wait: true, timeout: 60 })
await js(String.raw`new Promise((done) => setTimeout(done, 2000))`)

const jobs = JSON.parse(
  await js(String.raw`
    JSON.stringify([...new Set([...document.querySelectorAll('a[href*="/job/"]')]
      .map((one) => one.getAttribute('href')))].slice(0, 20))
  `)
)
cliLog(`Jobs on the run: ${jobs.length}`)

for (const job of jobs) {
  const said = await js(
    String.raw`
    (async () => {
      const job = ${JSON.stringify(job)}
      const page = await fetch(job, { credentials: 'include' }).then((answer) => answer.text())
      const internal = [...page.matchAll(/\/jobs\/(\d+)\/steps/g)][0]?.[1] ?? null
      if (internal === null) return JSON.stringify({ job, internal: null })

      // The run a job belongs to is in its own link. Every job of a pull request
      // is its own run here, so borrowing one run id for all of them answers 404.
      const run = job.replace(/\/job\/.*$/, '')
      const answer = await fetch(run + '/jobs/' + internal + '/steps', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      const steps = JSON.parse(await answer.text())
      const failed = Array.isArray(steps) && steps.some((step) => step.conclusion === 'failure')

      return JSON.stringify(
        failed
          ? { job, internal, failed, steps }
          : {
              job,
              internal,
              rows: (steps.length ?? 0) + ' steps: ' + (Array.isArray(steps) ? steps.map((step) => step.number + ' ' + step.name + ' ' + step.conclusion).join(', ') : 'none')
            }
      )
    })()
  `
  )

  cliLog(said)
}
