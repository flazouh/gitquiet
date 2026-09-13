/**
 * Plan 009's question, kept runnable after it was answered.
 *
 * It asked whether a grammar can be compiled at our own origin on a live
 * github.com page, and the answer was yes. What it is worth now is the asking:
 * the answer rests on Chrome's policy for extension pages and on a manifest line
 * of ours, and either can change under a feature that has no other way of
 * noticing. `bun scripts/probe-wasm.ts` is that check.
 *
 * It shares this document with the work rather than opening one of its own,
 * which is the finding it came back with.
 */

import { Effect } from "effect"
import { attempt, type Attempt, type Where } from "@/wasm-probe/attempt"
import { isWasmProbeWork, WASM_PROBE_ANSWER, type WasmProbeAnswer } from "@/wasm-probe/protocol"

const WORKER = "/wasm-probe-worker.js"

const at = (): Where => {
  const getURL = browser.runtime.getURL as (path: string) => string
  return {
    // The Ledger's, not copies of them: a probe compiling different bytes from
    // the ones the product compiles is not asking the product's question.
    runtime: getURL("/ledger/web-tree-sitter.wasm"),
    grammar: getURL("/ledger/tree-sitter-typescript.wasm"),
    sample: getURL("/wasm-probe/sample.txt")
  }
}

/**
 * The same question, asked inside a worker, with a deadline.
 *
 * A worker that is refused its script does not answer and does not fail — it
 * fires `error` on the owner if it gets that far, and on some refusals it does
 * not get that far. So the wait is bounded and the timeout is itself a finding.
 */
const inWorker = (where: Where): Effect.Effect<Attempt, string> =>
  Effect.callback<Attempt, string>((resume) => {
    const getURL = browser.runtime.getURL as (path: string) => string
    const worker = new Worker(getURL(WORKER), { type: "module" })

    worker.addEventListener("message", (event: MessageEvent) => {
      resume(Effect.succeed(event.data as Attempt))
    })
    worker.addEventListener("error", (event: ErrorEvent) => {
      resume(Effect.fail(`the worker failed: ${event.message}`))
    })
    worker.postMessage(where)

    return Effect.sync(() => worker.terminate())
  }).pipe(
    Effect.timeout(20_000),
    Effect.catch((cause) =>
      Effect.fail(typeof cause === "string" ? cause : "the worker never answered")
    )
  )

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isWasmProbeWork(message)) return undefined

  const where = at()

  return Effect.runPromise(
    Effect.gen(function* () {
      const here = yield* attempt("offscreen", where)
      const there = yield* inWorker(where).pipe(
        Effect.map((answer) => ({ answer, note: null as string | null })),
        Effect.catch((reason) => Effect.succeed({ answer: null, note: reason }))
      )

      return {
        kind: WASM_PROBE_ANSWER,
        attempts: there.answer === null ? [here] : [here, there.answer],
        notes: there.note === null ? [] : [`worker: ${there.note}`]
      } satisfies WasmProbeAnswer
    })
  )
})
