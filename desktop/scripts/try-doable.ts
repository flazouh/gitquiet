import { Effect } from "effect"
import { whatCanBeDone } from "../../src/domain/doable"
import { blockersOf } from "../../src/domain/landing"
import { readCard } from "../src/bun/card"
import { snapshotFrom } from "../src/view/snapshot"

/**
 * What this app can do to one pull request, and what stands in the way.
 *
 * The whole path in one place, without a window: GitHub's documented API is read by
 * the main process, the facts are turned into a snapshot the way the webview turns
 * them, and the domain is asked which of its eight verbs are on offer. That last
 * answer is the same set the card draws its buttons from, so this prints the buttons
 * without drawing them — and reads nothing but reads, so it is safe to run against
 * a repository somebody else owns.
 *
 *   bun desktop/scripts/try-doable.ts citrolabs/ego-lite#160
 */

const asked = process.argv[2] ?? "citrolabs/ego-lite#160"
const found = /^([^/]+)\/([^#]+)#(\d+)$/.exec(asked)
if (found === null) throw new Error(`Say it as owner/repo#number, not ${asked}`)

const card = { owner: found[1]!, repo: found[2]!, number: Number(found[3]) }
const token = (await Bun.$`gh auth token`.text()).trim()

const facts = await Effect.runPromise(readCard(token, card))
const snapshot = snapshotFrom(card, facts)

const can = whatCanBeDone({ state: snapshot.state, merge: snapshot.merge })
const blockers = blockersOf({
  isDraft: facts.merge.mergeable === "UNKNOWN" ? false : facts.state === "draft",
  hasConflicts: facts.merge.mergeable === "CONFLICTING",
  checksFailing: facts.checks.filter((one) => one.conclusion === "FAILURE").length,
  checksRunning: facts.checks.filter((one) => one.conclusion === null).length,
  reviewRequired: facts.merge.status === "BLOCKED",
  unresolved: facts.threads.filter((one) => !one.resolved).length
})

console.log(`${card.owner}/${card.repo}#${card.number}: ${facts.title}`)
console.log(`state: ${snapshot.state} | mergeable: ${facts.merge.mergeable} | status: ${facts.merge.status}`)
console.log(`checks: ${facts.checks.length} | threads: ${facts.threads.length} | files: ${facts.files.length}`)
console.log(`can: ${[...can].join(", ") || "nothing"}`)
console.log(`blocked by: ${blockers.map((one) => one.why).join("; ") || "nothing"}`)
