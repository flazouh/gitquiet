import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
import { FileBrowser } from "./FileBrowser"
import { mountSprite } from "./FileHeading"

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

const files = [file("packages/adapters/handler/request.ts"), file("README.md")]

const browser = (props: Partial<React.ComponentProps<typeof FileBrowser>> = {}) => (
  <FileBrowser
    files={files}
    fetchDiffs={() => Effect.succeed([])}
    diff={diffChoices(DEFAULTS.diff)}
    tree={treeChoices(DEFAULTS.tree)}
    {...props}
  />
)

const heading = () => screen.getByLabelText("Open file")

describe("naming the file above its diff", () => {
  test("says the folders it is in and the name it has, apart from each other", () => {
    render(browser())

    expect(within(heading()).getByText("packages/adapters/handler/")).toBeDefined()
    expect(within(heading()).getByText("request.ts")).toBeDefined()
  })

  test("gives up the folders rather than the name where there is room for one", () => {
    // Thirty rows in a four hundred pixel column, every one of them reading
    // "features/code-review/skills/review-pr/scripts/pro…". The name is the
    // answer to which file this is, and it was the part being thrown away.
    render(browser())

    const clipped = (one: HTMLElement) => one.closest(".truncate") !== null

    expect(clipped(within(heading()).getByText("packages/adapters/handler/"))).toBe(true)
    expect(clipped(within(heading()).getByText("request.ts"))).toBe(false)
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

  test("puts the symbols somewhere even on a page whose body has not arrived", () => {
    // GitHub streams their page, and this extension is mounted as soon as the
    // slot exists rather than at the end. Reaching for a body that is not there
    // yet threw inside React's commit, which takes the whole interface down
    // with it and leaves the reader an empty column.
    const page = new DOMParser().parseFromString("<html><head></head><body></body></html>", "text/html")
    page.documentElement.removeChild(page.body)
    expect(page.body).toBeNull()

    mountSprite(page)

    expect(page.getElementById("gitquiet-material-sprite")).not.toBeNull()
  })
})
