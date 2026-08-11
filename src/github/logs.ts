import { Effect } from "effect"

/**
 * The end of a log, read without holding the whole of it.
 *
 * A whole job's log is usually tens of kilobytes and occasionally hundreds of
 * megabytes, and the end is the part worth reading — where a failure lands and
 * where a job says what it did. So the body is read in pieces and only the
 * last few hundred lines are kept, with the count going up as the rest goes
 * past: what comes back knows its own line numbers, which is what lets the
 * panel agree with the log on GitHub.
 *
 * Reading what those lines say is `domain/logs.ts`, which needs no stream and
 * no network. This is the part that does.
 */
export const tailOf = Effect.fn("logs.tailOf")(function* (
  body: ReadableStream<Uint8Array>,
  keep: number
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let held: Array<string> = []
  let dropped = 0
  let rest = ""

  const push = (rows: ReadonlyArray<string>) => {
    held.push(...rows)
    if (held.length <= keep) return
    dropped += held.length - keep
    held = held.slice(-keep)
  }

  const take = (chunk: string) => {
    const rows = (rest + chunk).split("\n")
    // The last piece may be half a line, so it waits for the next chunk.
    rest = rows.pop() ?? ""
    push(rows)
  }

  for (;;) {
    const { done, value } = yield* Effect.promise(() => reader.read())
    if (done) break
    take(decoder.decode(value, { stream: true }))
  }
  take(decoder.decode())
  // Whatever is left is the final line, which ended without a newline.
  if (rest !== "") push([rest])

  return { text: held.join("\n"), startAt: dropped + 1 }
})
