import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { RAISE_VIEW } from "./raise"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew, and "the textbox" would be several of them. Asking
 * within this render is the difference between a test that passes on its own and one
 * that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{RAISE_VIEW.draw()}</Supplied>).container)

describe("the raise view", () => {
  test("says which repository the issue is being raised in", () => {
    expect(drawn().getByText("oven-sh/bun")).toBeTruthy()
  })

  test("is caught partway through being filled in, an empty form being an empty picture", () => {
    const shot = drawn()

    const title = shot.getByLabelText("What happened, in one line") as HTMLInputElement
    expect(title.value).toBe("Bun.SQL sslmode=prefer times out when Postgres has no TLS")

    const body = shot.getByPlaceholderText(/reproduce it/) as HTMLTextAreaElement
    expect(body.value).toContain("docker run --rm --name bun-sql-prefer-repro")
    expect(body.value).toContain("ERR_POSTGRES_CONNECTION_TIMEOUT")
  })

  test("keeps the command intact, a template literal being able to eat a line break", () => {
    // A trailing backslash in a template literal joins the next line onto this one, so
    // the shell command would arrive as one unreadable line and nobody would see it in
    // the picture until it was already published.
    const body = drawn().getByPlaceholderText(/reproduce it/) as HTMLTextAreaElement

    expect(body.value).toContain("bun-sql-prefer-repro \\\n")
  })

  test("offers the send, which only a filled-in title makes pressable", () => {
    const raise = drawn().getByRole("button", { name: "Raise it" }) as HTMLButtonElement
    expect(raise.disabled).toBe(false)
  })
})
