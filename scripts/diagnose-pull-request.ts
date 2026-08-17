/**
 * Says exactly why a recorded pull request will not decode.
 *
 *     bun scripts/diagnose-pull-request.ts recordings/octo-repo-1419
 *
 * The screen has one thing to say when a payload changes shape — "something
 * GitHub sends has changed" — because a reader mid-review cannot act on a
 * schema error. This is where the schema error goes instead: point it at a
 * directory holding the payloads, named as the fixtures are, and it prints
 * the failing path and value.
 *
 * Record them from a page you are signed into:
 *
 *     for (const [name, route] of [
 *       ["changes", "/changes"],
 *       ["status-checks", "/page_data/status_checks"],
 *       ["merge-box", "/page_data/merge_box?bypass_requirements=false"],
 *       ["description", "/page_data/description"],
 *       ["header", "/page_data/header"],
 *       ["issue-comments", "/page_data/issue_comments"]
 *     ]) { ... fetch and save ... }
 */
import { readFileSync } from "node:fs"
import { Effect, Option } from "effect"
import type { PullRequestRef } from "../src/domain/PullRequestRef"
import { toSnapshot } from "../src/github/snapshot"
import { whyItWouldNotDecode } from "../src/github/wire"

const [directory, owner = "owner", repo = "repo", number = "1"] = process.argv.slice(2)

if (directory === undefined) {
  console.error("usage: bun scripts/diagnose-pull-request.ts <directory> [owner] [repo] [number]")
  process.exit(2)
}

const read = (name: string): unknown =>
  JSON.parse(readFileSync(`${directory}/${name}.json`, "utf8")) as unknown

const reference: PullRequestRef = { owner, repo, number: Number(number) }

// The result rather than the promise: a rejected `runPromise` hands back a fibre
// failure whose message is the word `Error`, and the field that would not decode
// is inside it. Read as a value, the refusal still knows.
const outcome = await Effect.runPromise(
  Effect.result(
    toSnapshot(reference, {
      changes: read("changes"),
      statusChecks: read("status-checks"),
      mergeBox: read("merge-box"),
      description: read("description"),
      header: read("header"),
      issueComments: read("issue-comments")
    })
  )
)

if (outcome._tag === "Failure") {
  console.error("undecodable:\n")
  console.error(whyItWouldNotDecode(outcome.failure))
  process.exit(1)
}

const snapshot = outcome.success

console.log("decodes cleanly")
console.log({
  state: snapshot.state,
  files: snapshot.files.length,
  checks: snapshot.checks.length,
  // None where GitHub would not serve the merge box, which is a thing this script is
  // run to find out: the read now succeeds without one, so the difference has to show.
  blockers: Option.map(snapshot.merge, (merge) => merge.blockers.map((blocker) => blocker.name))
})
