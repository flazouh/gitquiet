import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { FetchedDiff, FileDiff } from "../domain/PullRequest"
import { diffLibrary } from "./library"

const aDiff = (): FileDiff => ({ isBinary: false, isTruncated: false, lines: [] })

/** A fetcher that records what it was asked for, and answers everything. */
const recording = () => {
  const asked: Array<ReadonlyArray<string>> = []
  const fetch = (paths: ReadonlyArray<string>): Promise<ReadonlyArray<FetchedDiff>> => {
    asked.push(paths)
    return Promise.resolve(paths.map((path) => ({ path, diff: aDiff() })))
  }
  return { asked, fetch }
}

/** A fetcher that answers only when told to, so waiting is observable. */
const deferred = () => {
  const asked: Array<ReadonlyArray<string>> = []
  const settle: Array<() => void> = []
  const fetch = (paths: ReadonlyArray<string>): Promise<ReadonlyArray<FetchedDiff>> => {
    asked.push(paths)
    return new Promise((resolve) => {
      settle.push(() => resolve(paths.map((path) => ({ path, diff: aDiff() }))))
    })
  }
  return { asked, settle, fetch }
}

describe("the library of diffs, which asks the network as little as it can", () => {
  test("asks once for a file opened twice", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    expect(Option.isSome(await library.ask("a.ts"))).toBe(true)
    expect(Option.isSome(await library.ask("a.ts"))).toBe(true)

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("asks once for a file opened twice before the first answer arrives", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    await Promise.all([library.ask("a.ts"), library.ask("a.ts")])

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("sends a warmed window as one request", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    library.warm(["a.ts", "b.ts", "c.ts"])
    await library.ask("c.ts")

    expect(network.asked).toEqual([["c.ts", "a.ts", "b.ts"]])
  })

  test("says nothing about a file it already holds", async () => {
    const network = recording()
    const library = diffLibrary(network.fetch)

    await library.ask("a.ts")
    library.warm(["a.ts"])
    await library.ask("a.ts")

    expect(network.asked).toEqual([["a.ts"]])
  })

  test("keeps to its batch size and its number in flight", async () => {
    const network = deferred()
    const library = diffLibrary(network.fetch, { batch: 2, inFlight: 2 })

    library.warm(["a", "b", "c", "d", "e", "f"])
    await Promise.resolve()
    await Promise.resolve()

    expect(network.asked).toEqual([
      ["a", "b"],
      ["c", "d"]
    ])

    network.settle[0]?.()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(network.asked).toHaveLength(3)
  })

  test("remembers that GitHub had nothing for a file, and does not ask again", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    const library = diffLibrary((paths) => {
      asked.push(paths)
      return Promise.resolve([])
    })

    expect(Option.isNone(await library.ask("huge.bin"))).toBe(true)
    expect(Option.isNone(await library.ask("huge.bin"))).toBe(true)

    expect(asked).toHaveLength(1)
  })

  test("tries again after a request that failed, since that says nothing about the file", async () => {
    const asked: Array<ReadonlyArray<string>> = []
    const library = diffLibrary((paths) => {
      asked.push(paths)
      return Promise.reject(new Error("offline"))
    })

    expect(Option.isNone(await library.ask("a.ts"))).toBe(true)
    expect(Option.isNone(await library.ask("a.ts"))).toBe(true)

    expect(asked).toHaveLength(2)
  })
})
