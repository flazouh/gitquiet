import { describe, expect, test } from "bun:test"
import { keptReads } from "./kept"

const counting = (answer: (key: string) => Promise<string> = async (key) => `read ${key}`) => {
  let reads = 0
  const kept = keptReads<string, string>((key) => {
    reads += 1
    return answer(key)
  })
  return { kept, reads: () => reads }
}

const held = <T,>() => {
  let settle = (_: T) => {}
  let refuse = (_: unknown) => {}
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve
    refuse = reject
  })
  return { promise, settle, refuse }
}

describe("reading once", () => {
  test("reads the first time and remembers after that", async () => {
    const { kept, reads } = counting()

    expect(await kept.ask("a")).toBe("read a")
    expect(await kept.ask("a")).toBe("read a")

    expect(reads()).toBe(1)
  })

  test("keeps keys apart", async () => {
    const { kept, reads } = counting()

    await kept.ask("a")
    await kept.ask("b")

    expect(reads()).toBe(2)
  })

  test("folds together two asks for the same key in the air at once", async () => {
    const answer = held<string>()
    const { kept, reads } = counting(() => answer.promise)

    const first = kept.ask("a")
    const second = kept.ask("a")
    answer.settle("read a")

    expect(await first).toBe("read a")
    expect(await second).toBe("read a")
    expect(reads()).toBe(1)
  })

  test("warming means the ask that follows costs nothing", async () => {
    const { kept, reads } = counting()

    kept.warm("a")
    await kept.ask("a")
    kept.warm("a")

    expect(reads()).toBe(1)
  })

  test("has nothing in hand until the read lands, and then has it", async () => {
    const answer = held<string>()
    const { kept } = counting(() => answer.promise)

    kept.warm("a")
    expect(kept.held("a")).toBeUndefined()

    answer.settle("read a")
    await Promise.resolve()

    expect(kept.held("a")).toBe("read a")
  })

  test("forgets a failure, so the next ask tries again", async () => {
    let attempt = 0
    const kept = keptReads<string, string>(async (key) => {
      attempt += 1
      if (attempt === 1) throw new Error("HTTP 500")
      return `read ${key}`
    })

    await expect(kept.ask("a")).rejects.toThrow("HTTP 500")
    expect(await kept.ask("a")).toBe("read a")
    expect(attempt).toBe(2)
  })

  test("a warm that fails is nobody's problem", async () => {
    const kept = keptReads<string, string>(async () => {
      throw new Error("HTTP 500")
    })

    kept.warm("a")
    await Promise.resolve()

    expect(kept.held("a")).toBeUndefined()
  })
})
