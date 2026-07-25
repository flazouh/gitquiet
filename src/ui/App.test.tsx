import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { App } from "./App"

afterEach(cleanup)

const reference = { owner: "microsoft", repo: "vscode", number: 327442 }
const header = { number: 327442, title: "Polish multi-file diffs in Agents window" }

describe("the page we render in GitHub's place", () => {
  test("shows the pull request title, repository and number", () => {
    render(<App reference={reference} header={header} />)

    expect(screen.getByRole("heading").textContent).toBe(
      "Polish multi-file diffs in Agents window"
    )
    expect(screen.getByText("microsoft/vscode")).toBeDefined()
    expect(screen.getByText("#327442")).toBeDefined()
  })

  test("always offers a way back to GitHub's own page", () => {
    render(<App reference={reference} header={header} />)

    const link = screen.getByRole("link", { name: "Open on GitHub" })
    expect(link.getAttribute("href")).toBe("https://github.com/microsoft/vscode/pull/327442")
  })
})
