import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { blobSha } from "./blob"

/**
 * Against `git hash-object`, which is the only authority on what these are.
 *
 * A hash that is merely consistent with itself would key a Ledger perfectly
 * well and would not be git's name for the file, which is the whole reason for
 * spending SHA-1 on it rather than something faster.
 */
const gitSays = async (text: string): Promise<string> => {
  const path = `/tmp/gitquiet-blob-${Math.random().toString(36).slice(2)}`
  await Bun.write(path, text)
  const said = await Bun.$`git hash-object ${path}`.text()
  return said.trim()
}

describe("what git calls a file's contents", () => {
  test("agrees with git on an ordinary file", async () => {
    const text = "export const one = 1\n"

    expect(await Effect.runPromise(blobSha(text))).toBe(await gitSays(text))
  })

  test("agrees with git on an empty one", async () => {
    expect(await Effect.runPromise(blobSha(""))).toBe(await gitSays(""))
  })

  test("counts the header's length in bytes, not in characters", async () => {
    // An accent and an emoji are one character each and several bytes each. A
    // header written from the character count hashes to something git has never
    // heard of, and every file with a name in it would be re-read for ever.
    const text = "const café = '🍰'\n"

    expect(await Effect.runPromise(blobSha(text))).toBe(await gitSays(text))
  })

  test("gives two different files two different names", async () => {
    const one = await Effect.runPromise(blobSha("a"))
    const two = await Effect.runPromise(blobSha("b"))

    expect(one).not.toBe(two)
    expect(one).toHaveLength(40)
  })
})
