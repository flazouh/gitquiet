import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type Way, Ways } from "./Ways"

afterEach(cleanup)

const WAYS = [
  { name: "rendered", said: "Rendered", art: "eye" },
  { name: "source", said: "Source", art: "code" }
] as const satisfies ReadonlyArray<Way<"rendered" | "source">>

const showing = (on: "rendered" | "source", picked: Array<string> = []) =>
  render(
    <Ways
      ways={WAYS}
      on={on}
      onPick={(way) => picked.push(way)}
      label="How to read this file"
    />
  )

describe("the two ways to look at the same thing", () => {
  test("names each way in words, because a glyph cannot say which is which", () => {
    // The whole of what makes a switch of icons usable: the word survives as the
    // accessible name, so a reader who cannot read the drawing is not stuck.
    showing("rendered")

    expect(screen.getByRole("button", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Source" })).toBeTruthy()
  })

  test("says which one the reader is on", () => {
    showing("source")

    expect(screen.getByRole("button", { name: "Source" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: "Rendered" }).getAttribute("aria-pressed")).toBe(
      "false"
    )
  })

  test("reports the way that was pressed, by the name the call site gave it", async () => {
    const picked: Array<string> = []
    showing("rendered", picked)

    await userEvent.click(screen.getByRole("button", { name: "Source" }))

    expect(picked).toEqual(["source"])
  })

  test("stands as one group, so the pair is reached as a pair", () => {
    showing("rendered")

    expect(screen.getByRole("group", { name: "How to read this file" })).toBeTruthy()
  })
})
