import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../settings/apply"
import { DEFAULTS } from "../settings/Settings"
import { FileBrowser } from "./FileBrowser"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 41,
  linesDeleted: 5,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const files = [file("framework/adapters/handler/request.ts"), file("README.md")]

const browser = (props: Partial<React.ComponentProps<typeof FileBrowser>> = {}) => (
  <FileBrowser
    files={files}
    fetchDiffs={async () => []}
    diff={diffChoices(DEFAULTS.diff)}
    tree={treeChoices(DEFAULTS.tree)}
    {...props}
  />
)

const heading = () => screen.getByLabelText("Open file")

describe("naming the file above its diff", () => {
  test("says the folders it is in and the name it has, apart from each other", () => {
    render(browser())

    expect(within(heading()).getByText("framework/adapters/handler/")).toBeDefined()
    expect(within(heading()).getByText("request.ts")).toBeDefined()
  })

  test("says how much of it changed", () => {
    render(browser())

    expect(within(heading()).getByText("+41")).toBeDefined()
    expect(within(heading()).getByText("−5")).toBeDefined()
  })

  test("draws the icon its type is known by", () => {
    render(browser())

    const drawn = heading().querySelector("use")
    expect(drawn?.getAttribute("href")).toBe("#mi-typescript")
    // The symbols themselves are on the page, or the reference above draws
    // nothing at all.
    expect(document.querySelector("#mi-typescript")).not.toBeNull()
  })

  test("follows the file being read", async () => {
    render(browser())

    await userEvent.click(screen.getByRole("button", { name: /Next file/ }))

    expect(within(heading()).getByText("README.md")).toBeDefined()
    expect(heading().querySelector("use")?.getAttribute("href")).toBe("#mi-readme")
  })

  test("says nothing about folders for a file at the root", () => {
    render(browser({ files: [file("README.md")] }))

    expect(heading().textContent).toContain("README.md")
    expect(heading().textContent).not.toContain("/")
  })
})
