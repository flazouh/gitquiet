import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { Opened } from "../domain/repoHome"
import { Reading } from "./ReadingPane"

afterEach(cleanup)

const opened = (over: Partial<Opened> = {}): Opened => ({
  path: "src/ui/Field.tsx",
  lines: ["export const Field = () => null"],
  rendered: Option.none(),
  ...over
})

const showing = (over: Partial<Parameters<typeof Reading>[0]> = {}) =>
  render(
    <Reading
      path="src/ui/Field.tsx"
      opened={opened()}
      repo={{ owner: "flowline-labs", repo: "flowline" }}
      branch="main"
      head="abc123"
      {...over}
    />
  )

const pane = () => screen.getByLabelText("File")

describe("the file, and what their page still owns of it", () => {
  test("keeps History and Raw on the strip, on the addresses GitHub still draws", () => {
    showing()

    expect(within(pane()).getByRole("link", { name: "History" }).getAttribute("href")).toBe(
      "/flowline-labs/flowline/commits/main/src/ui/Field.tsx"
    )
    expect(within(pane()).getByRole("link", { name: "Raw" }).getAttribute("href")).toBe(
      "/flowline-labs/flowline/raw/main/src/ui/Field.tsx"
    )
  })

  test("keeps Download on the raw route, named after the file", () => {
    showing()

    const down = within(pane()).getByRole("link", { name: "Download" })
    expect(down.getAttribute("href")).toBe("/flowline-labs/flowline/raw/main/src/ui/Field.tsx")
    expect(down.getAttribute("download")).toBe("Field.tsx")
  })

  test("puts the file on the clipboard from Copy", async () => {
    const who = userEvent.setup()
    const copied: Array<string> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (said: string) => {
          copied.push(said)
          return Promise.resolve()
        }
      }
    })

    showing()
    await who.click(within(pane()).getByRole("button", { name: "Copy" }))

    await waitFor(() => expect(copied).toEqual(["export const Field = () => null"]))
  })

  test("holds the raw user content address in the menu, which is the one the report named", async () => {
    const who = userEvent.setup()
    showing()

    await who.click(within(pane()).getByRole("button", { name: "More" }))

    expect(screen.getByRole("menuitem", { name: "Raw user content" }).getAttribute("href")).toBe(
      "https://raw.githubusercontent.com/flowline-labs/flowline/main/src/ui/Field.tsx"
    )
  })

  test("holds Blame and the permalink in that menu as well", async () => {
    const who = userEvent.setup()
    showing()

    await who.click(within(pane()).getByRole("button", { name: "More" }))

    expect(screen.getByRole("menuitem", { name: "Blame" }).getAttribute("href")).toBe(
      "/flowline-labs/flowline/blame/main/src/ui/Field.tsx"
    )
    expect(screen.getByRole("menuitem", { name: "Permalink" }).getAttribute("href")).toBe(
      "/flowline-labs/flowline/blob/abc123/src/ui/Field.tsx"
    )
  })

  test("puts the path on the clipboard from that menu", async () => {
    const who = userEvent.setup()
    const copied: Array<string> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (said: string) => {
          copied.push(said)
          return Promise.resolve()
        }
      }
    })

    showing()
    await who.click(within(pane()).getByRole("button", { name: "More" }))
    await who.click(screen.getByRole("menuitem", { name: "Copy path" }))

    await waitFor(() => expect(copied).toEqual(["src/ui/Field.tsx"]))
  })

  test("leaves the holds off until the repository and the branch are known", () => {
    showing({ repo: undefined, branch: undefined })

    expect(within(pane()).queryByRole("link", { name: "Raw" })).toBeNull()
    expect(within(pane()).queryByRole("button", { name: "More" })).toBeNull()
  })

  test("does not offer a way back to the README on the strip", () => {
    // The tree and the address already do that. A second control on the file
    // named the document this pane replaced, which is not a hold their page had.
    showing()

    expect(within(pane()).queryByRole("button", { name: "Back to the README" })).toBeNull()
    expect(within(pane()).queryByText("← README")).toBeNull()
  })
})
