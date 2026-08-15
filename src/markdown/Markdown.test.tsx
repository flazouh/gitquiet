import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect } from "effect"
import { highlight } from "./highlight"
import { resetHighlightLoader, setHighlightLoader } from "./loadHighlight"
import { resetMermaidLoader, setMermaidLoader } from "./loadMermaid"
import { Markdown } from "./Markdown"
import { MarkdownDrawProvider } from "./runtime"

afterEach(() => {
  cleanup()
  resetHighlightLoader()
  resetMermaidLoader()
})

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

  test("draws an image with the words that describe it", () => {
    render(<Markdown markdown={"![The working set](https://example.com/shot.png)"} />)

    const shot = screen.getByRole("img", { name: "The working set" })
    expect(shot.getAttribute("src")).toBe("https://example.com/shot.png")
  })

  test("draws a repository's own shot from its raw host", () => {
    render(
      <Markdown markdown={"![A shot](docs/shot.png)"} owner="flazouh" repo="gitquiet" />
    )

    expect(screen.getByRole("img", { name: "A shot" }).getAttribute("src")).toBe(
      "https://raw.githubusercontent.com/flazouh/gitquiet/HEAD/docs/shot.png"
    )
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

  test("colours a typescript fence once a highlighter is provided", async () => {
    setHighlightLoader(() => Effect.succeed(highlight))
    render(<Markdown markdown={"```ts\nconst x = 1\n```"} />)

    await waitFor(() => expect(document.querySelector("code span")).not.toBeNull())
    expect(screen.getByText("const", { exact: false })).toBeTruthy()
  })

  test("draws a mermaid fence as a diagram once a renderer is provided", async () => {
    setMermaidLoader(() =>
      Effect.succeed((_source: string) => Effect.succeed('<svg><title>diagram</title></svg>'))
    )
    render(<Markdown markdown={"```mermaid\ngraph TD\nA-->B\n```"} />)

    await waitFor(() => expect(document.querySelector("svg")).not.toBeNull())
  })

  test("does not leave a mermaid fence as a code block GitHub can steal", () => {
    render(<Markdown markdown={"```mermaid\ngraph TD\nA-->B\n```"} />)

    expect(document.querySelector("code[data-language='mermaid']")).toBeNull()
    expect(document.querySelector(".markdown-mermaid")).not.toBeNull()
  })

  test("draws mermaid from the tree provider, not a module loader", async () => {
    setMermaidLoader(() =>
      Effect.succeed(() => Effect.succeed("<svg><title>module</title></svg>"))
    )
    render(
      <MarkdownDrawProvider
        highlight={() => Effect.succeed(null)}
        mermaid={() => Effect.succeed("<svg><title>provider</title></svg>")}
      >
        <Markdown markdown={"```mermaid\ngraph TD\nA-->B\n```"} />
      </MarkdownDrawProvider>
    )

    await waitFor(() => expect(document.querySelector("svg title")?.textContent).toBe("provider"))
  })
})
