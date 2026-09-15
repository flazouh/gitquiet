import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { ledgerThrough } from "./client"

/**
 * The question, and the worker being too asleep to hear it.
 *
 * The worker on the other end of this is a service worker, and a service worker
 * sleeps. Waking one races the message sent to wake it, and the message can
 * lose — which arrives as "Could not establish connection", a sentence about
 * Chrome's scheduling and not about the name a reader is holding Command over.
 * One of these turned up in a filmed run on a live pull request.
 */
describe("a question put to a worker that is still waking", () => {
  const reading = { path: "one.ts", text: "const a = 1\n" }
  const at = { row: 0, column: 6 }

  const answers = (writing: unknown) => ({ kind: "gitquiet/ledger-answer", writing })

  test("is put again, and the second answer is the answer", async () => {
    let asked = 0
    const ledger = ledgerThrough(() => {
      asked += 1
      return asked === 1
        ? Promise.reject(new Error("Could not establish connection. Receiving end does not exist."))
        : Promise.resolve(answers({ name: "a", line: 1, from: 6, to: 7 }))
    })

    const found = await Effect.runPromise(ledger.writingAt(reading, at))

    expect(asked).toBe(2)
    expect(Option.isSome(found)).toBe(true)
  })

  test("gives up rather than asking for ever", async () => {
    let asked = 0
    const ledger = ledgerThrough(() => {
      asked += 1
      return Promise.reject(new Error("Receiving end does not exist."))
    })

    const failed = await Effect.runPromise(Effect.result(ledger.writingAt(reading, at)))

    expect(failed._tag).toBe("Failure")
    // Three: the question, and two more while the worker wakes.
    expect(asked).toBe(3)
  })

  test("does not ask twice where the worker answered, even with something odd", async () => {
    // An answer this does not recognise is still an answer. Asking again gets
    // the same one more slowly, and hides a protocol fault behind a delay.
    let asked = 0
    const ledger = ledgerThrough(() => {
      asked += 1
      return Promise.resolve({ kind: "something else entirely" })
    })

    await Effect.runPromise(Effect.result(ledger.writingAt(reading, at)))

    expect(asked).toBe(1)
  })
})
