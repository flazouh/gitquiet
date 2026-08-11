import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import type { Opened } from "../domain/repoHome"
import { shelfOf } from "./shelf"

const file = (path: string): Opened => ({ path, lines: [path], rendered: Option.none() })

/** A reader that counts what it was asked for, and can be made to wait. */
const counting = () => {
  const asked: Array<string> = []
  return {
    asked,
    read: (branch: string, path: string) =>
      Effect.sync(() => {
        asked.push(`${branch} ${path}`)
        return file(path)
      })
  }
}

describe("the files of a repository, read once", () => {
  test("reads a file the first time it is asked for", async () => {
    const { asked, read } = counting()
    const shelf = shelfOf(read)

    expect((await Effect.runPromise(shelf.ask("main", "a.ts"))).path).toBe("a.ts")
    expect(asked).toEqual(["main a.ts"])
  })

  test("does not read it again, which is what makes the second opening instant", async () => {
    const { asked, read } = counting()
    const shelf = shelfOf(read)

    await Effect.runPromise(shelf.ask("main", "a.ts"))
    await Effect.runPromise(shelf.ask("main", "a.ts"))

    expect(asked).toEqual(["main a.ts"])
  })

  test("hands back what warming has already fetched, without waiting", async () => {
    const { read } = counting()
    const shelf = shelfOf(read)

    shelf.warm("main", "a.ts")
    // The fork the warm started resolves on the next turn of the loop.
    await Effect.runPromise(Effect.void)

    expect(shelf.held("main", "a.ts")?.path).toBe("a.ts")
  })

  test("holds nothing for a file nobody has read", () => {
    expect(shelfOf(counting().read).held("main", "a.ts")).toBeUndefined()
  })

  test("keeps the branches apart, because one path is two files on two branches", async () => {
    const { asked, read } = counting()
    const shelf = shelfOf(read)

    await Effect.runPromise(shelf.ask("main", "a.ts"))
    await Effect.runPromise(shelf.ask("next", "a.ts"))

    expect(asked).toEqual(["main a.ts", "next a.ts"])
    expect(shelf.held("next", "a.ts")).toBeDefined()
  })

  test("warming and then pressing is one read, not two", async () => {
    let running = 0
    let most = 0
    const shelf = shelfOf(() =>
      Effect.sync(() => {
        running = running + 1
        most = Math.max(most, running)
        running = running - 1
        return file("a.ts")
      })
    )

    shelf.warm("main", "a.ts")
    await Effect.runPromise(shelf.ask("main", "a.ts"))

    expect(most).toBe(1)
  })
})
