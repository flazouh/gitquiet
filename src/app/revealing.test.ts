import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { revealer } from "./revealing"

const AT = { base: "base-sha", head: "head-sha" }

/** A reader that counts what it was asked for and answers with a stand-in file. */
const counting = (fails: ReadonlySet<string> = new Set()) => {
  const asked: Array<string> = []
  const read = (sha: string, path: string) => {
    asked.push(`${sha}:${path}`)
    return fails.has(sha)
      ? Effect.fail(new Error(`no ${path} at ${sha}`))
      : Effect.succeed(`${path} as it is at ${sha}`)
  }
  return { asked, read }
}

describe("revealing the lines a patch left out", () => {
  test("asks for the whole file once and reuses it for the second reveal", async () => {
    const { asked, read } = counting()
    const reveal = revealer(read, AT).forFile("src/one.ts", "modified")

    expect(reveal).toBeDefined()
    const first = await reveal!()
    const second = await reveal!()

    expect(first).toEqual({
      before: "src/one.ts as it is at base-sha",
      after: "src/one.ts as it is at head-sha"
    })
    expect(second).toEqual(first)
    // Two halves, one read each, however many times they are revealed.
    expect(asked).toEqual(["base-sha:src/one.ts", "head-sha:src/one.ts"])
  })

  test("keeps two files apart", async () => {
    const { asked, read } = counting()
    const one = revealer(read, AT)

    await one.forFile("src/one.ts", "modified")!()
    await one.forFile("src/two.ts", "modified")!()

    expect(asked.length).toBe(4)
    expect(new Set(asked).size).toBe(4)
  })

  test("asks for only the new half of a file the pull request added", async () => {
    const { asked, read } = counting()

    const halves = await revealer(read, AT).forFile("src/new.ts", "added")!()

    expect(halves).toEqual({ before: null, after: "src/new.ts as it is at head-sha" })
    expect(asked).toEqual(["head-sha:src/new.ts"])
  })

  test("offers no way to reveal a file the pull request deleted", () => {
    const { asked, read } = counting()

    expect(revealer(read, AT).forFile("src/gone.ts", "deleted")).toBeUndefined()
    expect(asked).toEqual([])
  })

  /*
   * The one that matters. Handing the renderer `before: null` for a file that
   * had an old half redraws the whole file as an addition, so a failed read of
   * that half has to fail the reveal outright.
   */
  test("refuses rather than revealing a modified file as though it were new", async () => {
    const { read } = counting(new Set(["base-sha"]))

    const reveal = revealer(read, AT).forFile("src/one.ts", "modified")

    expect(reveal!()).rejects.toThrow()
  })

  test("lets a failed read be tried again rather than remembering the failure", async () => {
    let attempts = 0
    const read = (sha: string, path: string) => {
      attempts += 1
      return attempts === 1
        ? Effect.fail(new Error("the network was out"))
        : Effect.succeed(`${path} at ${sha}`)
    }

    const reveal = revealer(read, AT).forFile("src/one.ts", "added")

    await expect(reveal!()).rejects.toThrow()
    await expect(reveal!()).resolves.toEqual({ before: null, after: "src/one.ts at head-sha" })
  })
})
