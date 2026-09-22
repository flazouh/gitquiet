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

  test("takes the column the README takes, which is the one beside the tree", () => {
    showing()

    // The tree keeps the left of the front page, so a file opens on the right,
    // in the pane the README was in. `repoHomeScreen.test.tsx` holds the pair.
    expect(pane().className).toContain("lg:col-start-2")
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

/*
 * The same cap the pull request's files have, for the same reason: drawing a
 * file is synchronous, and a generated one of fourteen thousand lines held the
 * page for over two seconds. See `domain/heavyFile.ts`.
 */
describe("a file too long to draw without being asked", () => {
  const long = opened({ path: "src/catalogue.generated.ts", lines: Array.from({ length: 2500 }, (_, at) => `export const n${at} = ${at}`) })

  test("says how long it is, and waits", () => {
    showing({ path: "src/catalogue.generated.ts", opened: long })

    expect(within(pane()).getByText(/2,500 lines/)).toBeTruthy()
    expect(within(pane()).getByRole("button", { name: "Show the file" })).toBeTruthy()
  })

  test("draws it when the reader asks", async () => {
    showing({ path: "src/catalogue.generated.ts", opened: long })

    await userEvent.click(within(pane()).getByRole("button", { name: "Show the file" }))

    expect(within(pane()).queryByText(/2,500 lines/)).toBeNull()
  })

  test("holds the next long file back, though the pane is kept", async () => {
    // The pane outlives a file, so the one let through must not let the next.
    const view = showing({ path: "src/catalogue.generated.ts", opened: long })
    await userEvent.click(within(pane()).getByRole("button", { name: "Show the file" }))

    const next = opened({ path: "src/other.generated.ts", lines: long.lines })
    view.rerender(
      <Reading
        path="src/other.generated.ts"
        opened={next}
        repo={{ owner: "flowline-labs", repo: "flowline" }}
        branch="main"
        head="abc123"
      />
    )

    expect(within(pane()).getByText(/2,500 lines/)).toBeTruthy()
  })

  test("draws it at once where a name was followed to a line of it", () => {
    showing({ path: "src/catalogue.generated.ts", opened: long, at: 40 })

    expect(within(pane()).queryByText(/2,500 lines/)).toBeNull()
  })

  test("draws a file of ordinary length as it always did", () => {
    showing()

    expect(within(pane()).queryByText(/lines\. It waits/)).toBeNull()
  })
})
