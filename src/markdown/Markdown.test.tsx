import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect } from "effect"
import { highlight } from "./highlight"
import { resetHighlightLoader, setHighlightLoader } from "./loadHighlight"
import { resetMermaidLoader, setMermaidLoader } from "./loadMermaid"
import { Markdown } from "./Markdown"
import { MarkdownDrawProvider } from "./runtime"

/** The browser's own idle queue, put back after a test drives it by hand. */
const idled = globalThis.requestIdleCallback
const unidled = globalThis.cancelIdleCallback

afterEach(() => {
  cleanup()
  resetHighlightLoader()
  resetMermaidLoader()
  globalThis.requestIdleCallback = idled
  globalThis.cancelIdleCallback = unidled
})

/**
 * The idle queue, in the test's hands: nothing waiting for a quiet moment runs
 * until `runIdle` says so, and anything called off before then never runs.
 */
const holdIdleTime = () => {
  const waiting = new Map<number, () => void>()
  let asked = 0

  globalThis.requestIdleCallback = ((run: IdleRequestCallback) => {
    asked += 1
    waiting.set(asked, () => run({ didTimeout: false, timeRemaining: () => 0 }))
    return asked
  }) as typeof globalThis.requestIdleCallback

  globalThis.cancelIdleCallback = ((handle: number) => {
    waiting.delete(handle)
  }) as typeof globalThis.cancelIdleCallback

  return {
    runIdle: () =>
      act(() => {
        const due = [...waiting.values()]
        waiting.clear()
        for (const run of due) run()
      })
  }
}

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

  test("draws the reference definitions a document ends with, address and all", () => {
    // GitHub draws nothing for these, so a References section that is only
    // definitions ends at an empty heading — which reads as the file being cut.
    render(<Markdown markdown={"## References\n\n[0]: https://example.com/versioning"} />)

    expect(screen.getByText("[0]:")).toBeTruthy()
    const link = screen.getByRole("link", { name: "https://example.com/versioning" })
    expect(link.getAttribute("href")).toBe("https://example.com/versioning")
  })

  test("keeps a poisoned definition readable without making it a link", () => {
    render(<Markdown markdown={"[bad]: javascript:alert(1)"} />)

    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.getByText("javascript:alert(1)")).toBeTruthy()
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

  /*
   * Measured on a press between two pull requests: one diagram of 296 characters
   * held the main thread for 794ms, and the reader waited the whole of it for a
   * page that was otherwise drawn and ready at 220ms. Every coloured fence on the
   * same page cost between 8ms and 71ms. So the diagram waits and the colours do
   * not.
   */
  test("holds a diagram until the browser is idle, and colours a fence at once", async () => {
    const { runIdle } = holdIdleTime()

    const drawn = render(
      <MarkdownDrawProvider
        highlight={() => Effect.succeed("<span>coloured</span>")}
        mermaid={() => Effect.succeed("<svg><title>diagram</title></svg>")}
      >
        <Markdown markdown={"```ts\nconst x = 1\n```\n\n```mermaid\ngraph TD\nA-->B\n```"} />
      </MarkdownDrawProvider>
    )

    await waitFor(() => expect(drawn.container.querySelector("code span")).not.toBeNull())
    expect(drawn.container.querySelector("svg")).toBeNull()

    runIdle()

    await waitFor(() =>
      expect(drawn.container.querySelector("svg title")?.textContent).toBe("diagram")
    )
  })

  test("never draws a diagram for a page the reader has already left", () => {
    const { runIdle } = holdIdleTime()
    let asked = 0

    const drawn = render(
      <MarkdownDrawProvider
        highlight={() => Effect.succeed(null)}
        mermaid={() => {
          asked += 1
          return Effect.succeed("<svg><title>diagram</title></svg>")
        }}
      >
        <Markdown markdown={"```mermaid\ngraph TD\nA-->B\n```"} />
      </MarkdownDrawProvider>
    )

    drawn.unmount()
    runIdle()

    expect(asked).toBe(0)
  })

  test("does not show the diagram of the fence that was there before", async () => {
    const { runIdle } = holdIdleTime()
    const tree = (source: string) => (
      <MarkdownDrawProvider
        highlight={() => Effect.succeed(null)}
        mermaid={(code) => Effect.succeed(`<svg><title>${code.includes("A") ? "first" : "second"}</title></svg>`)}
      >
        <Markdown markdown={`\`\`\`mermaid\n${source}\n\`\`\``} />
      </MarkdownDrawProvider>
    )

    const drawn = render(tree("graph TD\nA-->B"))
    runIdle()
    await waitFor(() =>
      expect(drawn.container.querySelector("svg title")?.textContent).toBe("first")
    )

    drawn.rerender(tree("graph TD\nX-->Y"))

    expect(drawn.container.querySelector("svg")).toBeNull()
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
