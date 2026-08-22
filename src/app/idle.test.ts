import { describe, expect, test } from "bun:test"
import { eachIdle } from "./idle"

/** Polls until the condition holds, or the wait runs out. */
const until = async (holds: () => boolean): Promise<void> => {
  const start = Date.now()
  while (!holds() && Date.now() - start < 3_000) {
    await new Promise((settle) => setTimeout(settle, 10))
  }
}

describe("one act per quiet moment", () => {
  test("runs every act, in the order they were given", async () => {
    const ran: Array<string> = []
    eachIdle([() => ran.push("a"), () => ran.push("b"), () => ran.push("c")])

    await until(() => ran.length === 3)

    expect(ran).toEqual(["a", "b", "c"])
  })

  test("nothing runs in the moment the acts are handed over", () => {
    const ran: Array<string> = []
    eachIdle([() => ran.push("a")])

    // The first quiet moment is later by definition; an act run on the spot
    // would be inside the very interaction the wait exists to dodge.
    expect(ran).toEqual([])
  })

  test("calling it off before a moment arrives stops every act", async () => {
    const ran: Array<string> = []
    const stop = eachIdle([() => ran.push("a"), () => ran.push("b")])
    stop()

    // Long enough that an act still scheduled would have run.
    await new Promise((settle) => setTimeout(settle, 500))

    expect(ran).toEqual([])
  })
})
