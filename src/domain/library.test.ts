import { describe, expect, test } from "bun:test"
import { Deferred, Effect, Option } from "effect"
import type { FetchedDiff, FileDiff } from "../domain/PullRequest"
import { diffLibrary } from "./library"

const aDiff = (): FileDiff => ({ isBinary: false, isTruncated: false, lines: [] })

const ran = <A>(effect: Effect.Effect<A>): Promise<A> => Effect.runPromise(effect)

/** A fetcher that records what it was asked for, and answers everything. */
const recording = () => {
  const asked: Array<ReadonlyArray<string>> = []
  const fetch = (paths: ReadonlyArray<string>) =>
    Effect.sync(() => {
      asked.push(paths)
      return paths.map((path) => ({ path, diff: aDiff() }))
    })
  return { asked, fetch }
}

/** A fetcher that answers only when told to, so waiting is observable. */
const deferred = () => {
  const asked: Array<ReadonlyArray<string>> = []
  const settle: Array<() => void> = []
  const fetch = (paths: ReadonlyArray<string>) =>
    Effect.suspend(() => {
      asked.push(paths)
      const answer = Deferred.makeUnsafe<ReadonlyArray<FetchedDiff>>()
      settle.push(() => {
        Deferred.doneUnsafe(
          answer,
          Effect.succeed(paths.map((path) => ({ path, diff: aDiff() })))
        )
      })
      return Deferred.await(answer)
    })
  return { asked, settle, fetch }
}

/** Long enough for the fibers the library forks to have had their turn. */
const settled = () => ran(Effect.sleep(0))

describe("the library of diffs, which asks the network as little as it can", () => {
  test("asks once for a file opened twice", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    expect(Option.isSome(await ran(library.ask("a.ts")))).toBe(true)
    expect(Option.isSome(await ran(library.ask("a.ts")))).toBe(true)

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("asks once for a file opened twice before the first answer arrives", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    await ran(Effect.all([library.ask("a.ts"), library.ask("a.ts")], { concurrency: 2 }))

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("sends a warmed window as one request", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    library.warm(["a.ts", "b.ts", "c.ts"])
    await ran(library.ask("c.ts"))

    expect(network.asked).toEqual([["c.ts", "a.ts", "b.ts"]])
  })

  test("says nothing about a file it already holds", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    await ran(library.ask("a.ts"))
    library.warm(["a.ts"])
    await ran(library.ask("a.ts"))

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("keeps to its batch size and its number in flight", async () => {
    const network = deferred()
    const library = diffLibrary(network.fetch, { batch: 2, inFlight: 2 })

    library.warm(["a", "b", "c", "d", "e", "f"])
    await settled()

    expect(network.asked).toEqual([
      ["a", "b"],
      ["c", "d"]
    ])

    network.settle[0]?.()
    await settled()

    expect(network.asked).toHaveLength(3)
  })

  test("remembers that GitHub had nothing for a file, and does not ask again", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    const library = diffLibrary((paths) =>
      Effect.sync(() => {
        asked.push(paths)
        return []
      })
    )

    expect(Option.isNone(await ran(library.ask("huge.bin")))).toBe(true)
    expect(Option.isNone(await ran(library.ask("huge.bin")))).toBe(true)

    expect(asked).toHaveLength(1)
  })

  test("tries again after a request that failed, since that says nothing about the file", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    const library = diffLibrary((paths) =>
      Effect.suspend(() => {
        asked.push(paths)
        return Effect.fail(new Error("offline"))
      })
    )

    expect(Option.isNone(await ran(library.ask("a.ts")))).toBe(true)
    expect(Option.isNone(await ran(library.ask("a.ts")))).toBe(true)

    expect(asked).toHaveLength(2)
  })
})
