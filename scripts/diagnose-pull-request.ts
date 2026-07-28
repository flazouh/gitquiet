/**
 * Says exactly why a recorded pull request will not decode.
 *
 *     bun scripts/diagnose-pull-request.ts recordings/ori-1419
 *
 * The screen has one thing to say when a payload changes shape — "something
 * GitHub sends has changed" — because a reader mid-review cannot act on a
 * schema error. This is where the schema error goes instead: point it at a
 * directory holding the four payloads, named as the fixtures are, and it prints
 * the failing path and value.
 *
 * Record them from a page you are signed into:
 *
 *     for (const [name, route] of [
 *       ["changes", "/changes"],
 *       ["status-checks", "/page_data/status_checks"],
 *       ["merge-box", "/page_data/merge_box?merge_method=MERGE&bypass_requirements=false"],
 *       ["description", "/page_data/description"]
 *     ]) { ... fetch and save ... }
 */
import { readFileSync } from "node:fs"
import { Effect } from "effect"
import type { PullRequestRef } from "../src/domain/PullRequestRef"
import { toSnapshot } from "../src/github/snapshot"

const [directory, owner = "owner", repo = "repo", number = "1"] = process.argv.slice(2)

if (directory === undefined) {
  console.error("usage: bun scripts/diagnose-pull-request.ts <directory> [owner] [repo] [number]")
  process.exit(2)
}

const read = (name: string): unknown =>
  JSON.parse(readFileSync(`${directory}/${name}.json`, "utf8")) as unknown

const reference: PullRequestRef = { owner, repo, number: Number(number) }

const snapshot = await Effect.runPromise(
  toSnapshot(reference, {
    changes: read("changes"),
    statusChecks: read("status-checks"),
    mergeBox: read("merge-box"),
    description: read("description")
  })
).catch((cause: unknown) => {
  console.error("undecodable:\n")
  console.error(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause))
  process.exit(1)
})

console.log("decodes cleanly")
console.log({
  state: snapshot.state,
  files: snapshot.files.length,
  checks: snapshot.checks.length,
  blockers: snapshot.merge.blockers.map((blocker) => blocker.name)
})
