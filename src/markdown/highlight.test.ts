import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { highlight } from "./highlight"

describe("colouring a labelled fence", () => {
  test("colours a typescript fence", async () => {
    const html = await Effect.runPromise(highlight("const x = 1", "ts", "light"))

    expect(html).toContain("const")
    expect(html).toContain("<span")
  })

  test("maps sh to the shell grammar", async () => {
    const html = await Effect.runPromise(highlight("ori login", "sh", "light"))

    expect(html).not.toBeNull()
    expect(html).toContain("ori")
  })

  test("leaves an unknown language uncoloured", async () => {
    expect(await Effect.runPromise(highlight("graph TD", "mermaid", "light"))).toBeNull()
  })
})
