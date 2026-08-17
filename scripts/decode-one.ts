/**
 * Reads what `capture-one.mjs` wrote with the schemas production reads it with.
 *
 * The one question it answers: for each route, did GitHub not answer, or did GitHub
 * answer in a shape `wire.ts` does not know? The screen says the same sentence for
 * both, and only the second is something anybody here can fix.
 *
 *     bun scripts/decode-one.ts
 */

import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { whereverItIs } from "../src/github/wherever"
import {
  ChangesRoute,
  DescriptionRoute,
  HeaderRoute,
  IssueCommentsRoute,
  MergeBoxRoute,
  PreviewStackRoute,
  StatusChecksRoute,
  whyItWouldNotDecode
} from "../src/github/wire"

const WHERE = "/tmp/one-capture"

/**
 * Each route's reader, built here rather than the schema being carried.
 *
 * `whereverItIs` is applied where the schema is still its own type: a list of the
 * schemas themselves would have to name a type that all seven fit, and the only one
 * that does erases what the decoder needs.
 */
const ROUTES: ReadonlyArray<readonly [string, (raw: unknown) => Effect.Effect<unknown, unknown>]> =
  [
    ["changes", whereverItIs(ChangesRoute)],
    ["status_checks", whereverItIs(StatusChecksRoute)],
    ["merge_box", whereverItIs(MergeBoxRoute)],
    ["header", whereverItIs(HeaderRoute)],
    ["issue_comments", whereverItIs(IssueCommentsRoute)],
    ["description", whereverItIs(DescriptionRoute)],
    ["preview_stack", whereverItIs(PreviewStackRoute)]
  ]

for (const [name, read] of ROUTES) {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(`${WHERE}/${name}.body`, "utf8"))
  } catch {
    const body = readFileSync(`${WHERE}/${name}.body`, "utf8")
    const title = /<title>([^<]*)<\/title>/i.exec(body)?.[1]?.trim()
    console.log(`${name}: NOT JSON — ${title ?? body.slice(0, 60)}`)
    continue
  }

  const outcome = await Effect.runPromise(Effect.result(read(raw)))
  if (outcome._tag === "Failure") {
    console.log(`${name}: DRIFT\n${whyItWouldNotDecode(outcome.failure)}\n`)
  } else {
    console.log(`${name}: ok`)
  }
}
