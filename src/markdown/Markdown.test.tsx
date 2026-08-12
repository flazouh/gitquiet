import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Markdown } from "./Markdown"

afterEach(cleanup)

describe("rendering our markdown document", () => {
  test("draws a GFM table as tiled cells", () => {
    render(<Markdown markdown={"| Name | Status |\n| --- | --- |\n| Tables | Working |"} />)

    const table = screen.getByRole("table")
    expect(table.closest(".markdown-table")).not.toBeNull()
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy()
    expect(screen.getByRole("cell", { name: "Working" })).toBeTruthy()
  })

  test("renders a heading and a paragraph", () => {
    render(<Markdown markdown={"# Ori\n\nA CLI."} />)

    expect(screen.getByRole("heading", { level: 1, name: "Ori" })).toBeTruthy()
    expect(screen.getByText("A CLI.")).toBeTruthy()
  })

  test("does not make a javascript: link clickable", () => {
    render(<Markdown markdown={"[x](javascript:alert(1))"} />)

    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByText("x")).toBeTruthy()
  })

  test("renders a details section the reader can open", () => {
    render(<Markdown markdown={"<details>\n<summary>More</summary>\n\n- item\n\n</details>"} />)

    expect(screen.getByText("More").closest("summary")).not.toBeNull()
    expect(screen.getByText("item").closest("details")).not.toBeNull()
  })

  test("turns a mention and an issue number into links", () => {
    render(<Markdown markdown={"Thanks @alice for #12"} owner="ori" repo="cli" />)

    expect(screen.getByRole("link", { name: "@alice" }).getAttribute("href")).toBe(
      "https://github.com/alice"
    )
    expect(screen.getByRole("link", { name: "#12" }).getAttribute("href")).toBe(
      "https://github.com/ori/cli/issues/12"
    )
  })

  test("renders a suggestion fence as a suggestion", () => {
    render(<Markdown markdown={"```suggestion\nfoo\n```"} />)

    expect(document.querySelector(".markdown-suggestion")).not.toBeNull()
    expect(screen.getByText("foo")).toBeTruthy()
  })
})
