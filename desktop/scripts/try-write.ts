import { Effect } from "effect"
import type { Asked } from "../src/shared/wire"
import { write } from "../src/bun/write"

/**
 * Every write, against a pull request that is past deciding.
 *
 * Not a test of whether GitHub does these things — the only way to learn that is
 * to do one, and doing eight of them to a live pull request to see what happens is
 * not a thing to run from a script. It is a test of the half that can be wrong
 * quietly: the mutation names, the input field each one calls the pull request, and
 * the node id lookup they all share. A closed pull request refuses all eight for
 * reasons about its state, and a refusal about state is proof the mutation and its
 * input parsed. A schema mistake reads completely differently — "Field 'x' doesn't
 * exist", "Variable $input of type ... was provided invalid value" — so the check
 * at the bottom is for the absence of those, not for success.
 *
 *   bun desktop/scripts/try-write.ts
 */

const token = (await Bun.$`gh auth token`.text()).trim()
const card = { owner: "flazouh", repo: "githubpro", number: 21 }

const all: ReadonlyArray<Asked> = [
  { doing: "merge", method: "SQUASH" },
  { doing: "enqueue", how: "GROUP" },
  { doing: "dequeue" },
  { doing: "cancelAutoMerge" },
  { doing: "updateBranch", how: "MERGE" },
  { doing: "close" },
  { doing: "markReady" },
  { doing: "toDraft" }
]

/** What a mistake in this file would look like, as opposed to a refusal. */
const SCHEMA = [
  "doesn't exist",
  "provided invalid value",
  "Unknown argument",
  "is required, but it was not provided",
  "Cannot query field"
]

let wrong = 0

for (const asked of all) {
  const said = await Effect.runPromise(
    write(token, card, asked).pipe(
      Effect.as("no refusal — GitHub did it"),
      Effect.catchCause((cause) => Effect.succeed(String(cause).replace(/\s+/g, " ").slice(0, 160)))
    )
  )

  const schema = SCHEMA.find((phrase) => said.includes(phrase))
  if (schema !== undefined) wrong += 1

  console.log(`${schema === undefined ? "ok  " : "BAD "} ${asked.doing.padEnd(16)} ${said}`)
}

console.log(wrong === 0 ? "\nall eight parsed" : `\n${wrong} of eight did not parse`)
process.exit(wrong === 0 ? 0 : 1)
