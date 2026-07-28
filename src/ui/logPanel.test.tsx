import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { linesIn } from "../github/logs"
import { LogPanel } from "./LogPanel"

afterEach(cleanup)

const stamped = (rows: ReadonlyArray<string>) =>
  linesIn(rows.map((row) => `2026-01-01T00:00:00.0Z ${row}`).join("\n"))

const job = stamped([
  "##[group]Runner Image",
  "  Ubuntu 24.04",
  "  Included software: everything",
  "##[endgroup]",
  "Running the tests",
  "##[group]Run the suite",
  "##[error]src/app/main.ts:23:11 blew up",
  "##[endgroup]"
])

describe("folding what the runner says about itself", () => {
  test("keeps a group of chatter shut, with its name and how much is in it", () => {
    render(<LogPanel lines={job} />)

    expect(screen.getByText("Runner Image")).toBeDefined()
    expect(screen.queryByText(/Ubuntu 24.04/)).toBeNull()
  })

  test("opens the group that holds an error, without being asked", () => {
    render(<LogPanel lines={job} />)

    expect(screen.getByText(/blew up/)).toBeDefined()
  })

  test("opens a shut group when it is clicked, and shuts an open one", async () => {
    render(<LogPanel lines={job} />)

    await userEvent.click(screen.getByText("Runner Image"))
    expect(screen.getByText(/Ubuntu 24.04/)).toBeDefined()

    await userEvent.click(screen.getByText("Runner Image"))
    expect(screen.queryByText(/Ubuntu 24.04/)).toBeNull()
  })

  test("leaves loose lines outside any group where they were", () => {
    render(<LogPanel lines={job} />)

    expect(screen.getByText("Running the tests")).toBeDefined()
  })
})

describe("stepping through what went wrong", () => {
  test("says how many errors there are", () => {
    render(<LogPanel lines={job} />)

    expect(screen.getByText("1 error")).toBeDefined()
  })

  test("offers no count and no steps for a log with nothing wrong in it", () => {
    render(<LogPanel lines={stamped(["all fine", "still fine"])} />)

    expect(screen.getByText("2 lines")).toBeDefined()
    expect(screen.queryByLabelText("Next error")).toBeNull()
  })

  test("moves between errors when there is more than one", async () => {
    const two = stamped(["##[error]first thing", "in between", "##[error]second thing"])
    render(<LogPanel lines={two} />)

    expect(screen.getByText("2 errors")).toBeDefined()
    await userEvent.click(screen.getByLabelText("Next error"))
    await userEvent.click(screen.getByLabelText("Previous error"))

    // Both are on screen throughout; what moves is which one is picked out.
    expect(screen.getByText("first thing")).toBeDefined()
    expect(screen.getByText("second thing")).toBeDefined()
  })
})

describe("files a log names", () => {
  test("open in the diff when the pull request touches them", async () => {
    const opened = mock(() => {})
    render(
      <LogPanel lines={job} paths={["src/app/main.ts", "README.md"]} onOpenFile={opened} />
    )

    await userEvent.click(screen.getByText("src/app/main.ts:23:11"))

    expect(opened).toHaveBeenCalledWith("src/app/main.ts", 23)
  })

  test("link to GitHub when the pull request does not", () => {
    render(
      <LogPanel
        lines={job}
        paths={["README.md"]}
        onOpenFile={() => {}}
        hrefFor={(ref) => `https://github.com/o/r/blob/abc/${ref.path}#L${ref.line}`}
      />
    )

    const link = screen.getByText("src/app/main.ts:23:11").closest("a")
    expect(link?.getAttribute("href")).toBe("https://github.com/o/r/blob/abc/src/app/main.ts#L23")
  })

  test("stay as words when nothing can be done with them", () => {
    render(<LogPanel lines={job} />)

    expect(screen.getByText("src/app/main.ts:23:11").closest("a")).toBeNull()
    expect(screen.getByText("src/app/main.ts:23:11").closest("button")).toBeNull()
  })
})

describe("finding a line in a long log", () => {
  test("shows only the lines that say it, wherever they were folded", async () => {
    render(<LogPanel lines={job} />)

    await userEvent.type(screen.getByLabelText("Filter the log"), "ubuntu")

    // Picked out where it was found, not merely shown: the match wears a mark.
    expect(screen.getByText("Ubuntu").tagName).toBe("MARK")
    expect(screen.getByText(/24\.04/)).toBeDefined()
    expect(screen.queryByText("Running the tests")).toBeNull()
  })

  test("says so plainly when nothing in the log says it", async () => {
    render(<LogPanel lines={job} />)

    await userEvent.type(screen.getByLabelText("Filter the log"), "flibbertigibbet")

    expect(screen.getByText("Nothing in the log says that.")).toBeDefined()
  })
})

describe("taking the log elsewhere", () => {
  test("copies what is being shown", async () => {
    const written: Array<string> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (said: string) => {
          written.push(said)
          return Promise.resolve()
        }
      }
    })

    render(<LogPanel lines={stamped(["first", "second"])} />)
    await userEvent.click(screen.getByLabelText("Copy the log"))

    expect(written[0]).toBe("first\nsecond")
  })

  test("offers the whole log only while part of it is missing", () => {
    const { rerender } = render(
      <LogPanel lines={linesIn("late line", 900)} onWhole={() => {}} />
    )
    expect(screen.getByText("Whole log")).toBeDefined()

    rerender(<LogPanel lines={linesIn("first line", 1)} onWhole={() => {}} />)
    expect(screen.queryByText("Whole log")).toBeNull()
  })
})
