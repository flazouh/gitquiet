import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { forgetEverything, installStorage } from "../../tests/storage"
import type { Check } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { layer } from "../github/GitHubGateway"
import { loadPullRequest } from "./pullRequest"

/**
 * What the reader is shown first, and what arrives behind it.
 *
 * A tolerated failure is only knowable from the run around the check, which is a
 * document of half a megabyte read after the pull request's own routes have
 * answered. A pull request with three failing runs waited for three of those
 * before it drew anything — on the very pull request somebody opened in a hurry.
 * So the checks go on the screen as GitHub reported them and the run reads
 * soften what they can afterwards, which is the staged read every list here
 * already does.
 */

installStorage()
beforeEach(forgetEverything)
// And afterwards as well: a run that concluded is kept, and what this file keeps
// is a doctored one that no other test should ever be answered out of.
afterEach(forgetEverything)

const runPage = await Bun.file("tests/fixtures/runPage.html").text()

const reference: PullRequestRef = { owner: "microsoft", repo: "vscode", number: 327442 }

/** The two checks this doctors into failures, which one run answers for. */
const doctored = [
  "Code OSS / Compile & Hygiene (pull_request)",
  "Code OSS / Copilot - Check Telemetry (pull_request)"
]

const payload = draftWithBotFindings.statusChecks as {
  readonly statusChecks: ReadonlyArray<{ readonly displayName: string; readonly state: string }>
}

/**
 * A run of this file's own, rather than the one the fixture names.
 *
 * A concluded run is kept under its own address, and the store behind the
 * gateway outlives one test file. Two files doctoring the same run into two
 * different outcomes would each answer out of what the other left.
 */
const RUN = "44115577001"

const asFailing = {
  ...payload,
  statusChecks: payload.statusChecks.map((one, at) =>
    doctored.includes(one.displayName)
      ? {
          ...one,
          state: "FAILURE",
          targetUrl: `https://github.com/microsoft/vscode/actions/runs/${RUN}/job/${at + 1}`
        }
      : one
  )
}

/** Their run page as a run that concluded a success, which is what makes a failure tolerated. */
const green = runPage.replace(
  '<svg data-component="Octicon" width="22" height="22" class="octicon octicon-x-circle-fill color-fg-danger" aria-label="failed: "',
  '<svg data-component="Octicon" width="22" height="22" class="octicon octicon-check-circle-fill color-fg-success" aria-label="completed successfully: "'
)

const payloadFor = (url: string): unknown => {
  if (url.includes("/changes")) return draftWithBotFindings.changes
  if (url.includes("status_checks")) return asFailing
  if (url.includes("description")) return draftWithBotFindings.description
  if (url.includes("page_data/header")) return draftWithBotFindings.header
  if (url.includes("issue_comments")) return draftWithBotFindings.issueComments
  if (url.includes("preview_stack")) return null
  return draftWithBotFindings.mergeBox
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/**
 * GitHub, holding the run page back until this test says so.
 *
 * The whole question is what happens in the seconds before that answer, so the
 * answer is a promise the test resolves rather than a response that arrives on
 * its own.
 */
const holdingTheRun = (): { readonly answer: () => void } => {
  let answer = (): void => {}
  const held = new Promise<void>((done) => {
    answer = () => done()
  })

  const handler = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    if (url.includes("/actions/runs/")) {
      return held.then(
        () => new Response(green, { status: 200, headers: { "Content-Type": "text/html" } })
      )
    }
    return Promise.resolve(Response.json(payloadFor(url)))
  }

  globalThis.fetch = Object.assign(handler, { preconnect: realFetch.preconnect })
  return { answer: () => answer() }
}

const statesOf = (checks: ReadonlyArray<Check>): ReadonlyArray<string> =>
  checks.filter((check) => doctored.includes(check.name)).map((check) => check.state)

describe("reading a pull request whose checks include a tolerated failure", () => {
  test("says the checks as GitHub reported them without waiting for the run", async () => {
    const run = holdingTheRun()

    let arrived = (_: ReadonlyArray<Check>): void => {}
    const staged = new Promise<ReadonlyArray<Check>>((tell) => {
      arrived = tell
    })

    const reading = Effect.runPromise(
      loadPullRequest(reference, (loaded) => arrived(loaded.snapshot.checks)).pipe(
        Effect.provide(layer)
      )
    )

    // The stage lands while the run page is still held, which is the whole
    // claim: nothing the reader sees first is behind that read.
    expect(statesOf(await staged)).toEqual(["failed", "failed"])

    run.answer()

    expect(statesOf((await reading).snapshot.checks)).toEqual(["tolerated", "tolerated"])
  })

  test("softens the failure once the run says it was allowed, and never to green", async () => {
    const run = holdingTheRun()
    const seen: Array<ReadonlyArray<string>> = []

    const reading = Effect.runPromise(
      loadPullRequest(reference, (loaded) => {
        seen.push(statesOf(loaded.snapshot.checks))
        run.answer()
      }).pipe(Effect.provide(layer))
    )

    seen.push(statesOf((await reading).snapshot.checks))

    // Red, then tolerated. A check that passes through "succeeded" on the way
    // would tell the reader a job that fell over went fine.
    expect(seen).toEqual([
      ["failed", "failed"],
      ["tolerated", "tolerated"]
    ])
  })
})
