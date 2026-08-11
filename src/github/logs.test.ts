import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { linesIn } from "../domain/logs"
import { tailOf } from "./logs"

const streamOf = (text: string, pieces = 1): ReadableStream<Uint8Array> => {
  const bytes = new TextEncoder().encode(text)
  const size = Math.ceil(bytes.length / pieces)
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close()
      controller.enqueue(bytes.slice(at, at + size))
      at += size
    }
  })
}

const numbered = (count: number) =>
  Array.from({ length: count }, (_, at) => `2026-01-01T00:00:00.0Z line ${at + 1}`).join("\n")

describe("reading only the end of a log", () => {
  test("keeps the last lines and says which line they start at", async () => {
    const tail = await Effect.runPromise(tailOf(streamOf(numbered(1000)), 100))

    expect(linesIn(tail.text, tail.startAt)).toHaveLength(100)
    expect(linesIn(tail.text, tail.startAt)[0]).toMatchObject({
      at: 901,
      text: "line 901",
      tone: "plain"
    })
    expect(linesIn(tail.text, tail.startAt).at(-1)?.text).toBe("line 1000")
  })

  test("keeps a short log whole, starting where it starts", async () => {
    const tail = await Effect.runPromise(tailOf(streamOf(numbered(3)), 100))

    expect(tail.startAt).toBe(1)
    expect(linesIn(tail.text, tail.startAt).map((line) => line.text)).toEqual([
      "line 1",
      "line 2",
      "line 3"
    ])
  })

  test("does not lose a line that arrived split across two pieces", async () => {
    const tail = await Effect.runPromise(tailOf(streamOf(numbered(50), 17), 100))

    expect(linesIn(tail.text, tail.startAt)).toHaveLength(50)
    expect(linesIn(tail.text, tail.startAt).at(-1)?.text).toBe("line 50")
  })

  test("does not invent a line for a log that ends in a newline", async () => {
    const tail = await Effect.runPromise(tailOf(streamOf(`${numbered(5)}\n`), 100))

    expect(linesIn(tail.text, tail.startAt)).toHaveLength(5)
  })

  test("has nothing to say about an empty log", async () => {
    const tail = await Effect.runPromise(tailOf(streamOf(""), 100))

    expect(linesIn(tail.text, tail.startAt)).toEqual([])
  })
})
