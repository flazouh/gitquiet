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
})
