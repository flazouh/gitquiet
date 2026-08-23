import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Exit } from "effect"
import { keptReads } from "./kept"

const counting = (
  answer: (key: string) => Effect.Effect<string, unknown> = (key) => Effect.succeed(`read ${key}`)
) => {
  let reads = 0
  const kept = keptReads<string, string>((key) => {
    reads += 1
    return answer(key)
  })
  return { kept, reads: () => reads }
}

/** Long enough for a forked read to have run, which is all any of these wait on. */
const settled = () => Effect.runPromise(Effect.sleep(0))

describe("reading once", () => {
  test("reads the first time and remembers after that", async () => {
    const { kept, reads } = counting()

    expect(await Effect.runPromise(kept.ask("a"))).toBe("read a")
    expect(await Effect.runPromise(kept.ask("a"))).toBe("read a")

    expect(reads()).toBe(1)
  })

  test("keeps keys apart", async () => {
    const { kept, reads } = counting()

    await Effect.runPromise(kept.ask("a"))
    await Effect.runPromise(kept.ask("b"))

    expect(reads()).toBe(2)
  })

  test("folds together two asks for the same key in the air at once", async () => {
    const answer = Deferred.makeUnsafe<string>()
    const { kept, reads } = counting(() => Deferred.await(answer))

    const first = Effect.runPromise(kept.ask("a"))
    const second = Effect.runPromise(kept.ask("a"))
    await settled()
    Deferred.doneUnsafe(answer, Effect.succeed("read a"))

    expect(await first).toBe("read a")
    expect(await second).toBe("read a")
    expect(reads()).toBe(1)
  })

  test("warming means the ask that follows costs nothing", async () => {
    const { kept, reads } = counting()

    kept.warm("a")
    await Effect.runPromise(kept.ask("a"))
    kept.warm("a")

    expect(reads()).toBe(1)
  })

  test("has nothing in hand until the read lands, and then has it", async () => {
    const answer = Deferred.makeUnsafe<string>()
    const { kept } = counting(() => Deferred.await(answer))

    kept.warm("a")
    expect(kept.held("a")).toBeUndefined()

    Deferred.doneUnsafe(answer, Effect.succeed("read a"))
    await settled()

    expect(kept.held("a")).toBe("read a")
  })

  test("forgets a failure, so the next ask tries again", async () => {
    let attempt = 0
    const kept = keptReads<string, string>((key) => {
      attempt += 1
      return attempt === 1 ? Effect.fail(new Error("HTTP 500")) : Effect.succeed(`read ${key}`)
    })

    const refused = await Effect.runPromiseExit(kept.ask("a"))
    expect(Exit.isFailure(refused)).toBe(true)

    expect(await Effect.runPromise(kept.ask("a"))).toBe("read a")
    expect(attempt).toBe(2)
  })

  test("a warm that fails is nobody's problem", async () => {
    const kept = keptReads<string, string>(() => Effect.fail(new Error("HTTP 500")))

    kept.warm("a")
    await settled()

    expect(kept.held("a")).toBeUndefined()
  })
})

describe("naming the key", () => {
  test("folds two spellings of one key together, where a namer is given", async () => {
    let reads = 0
    const kept = keptReads(
      (key: { readonly owner: string; readonly repo: string }) => {
        reads += 1
        return Effect.succeed(`read ${key.owner}/${key.repo}`)
      },
      (key) => `${key.owner}/${key.repo}`
    )

    expect(await Effect.runPromise(kept.ask({ owner: "a", repo: "b" }))).toBe("read a/b")
    expect(await Effect.runPromise(kept.ask({ owner: "a", repo: "b" }))).toBe("read a/b")

    expect(reads).toBe(1)
  })
})
