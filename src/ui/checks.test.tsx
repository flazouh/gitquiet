import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { keptReads } from "../app/kept"
import { linesIn } from "../github/logs"
import type { Check, CheckNote, LogLine } from "../domain/PullRequest"
import { type Box, NEAR } from "./near"
import { Checks, logKey } from "./Sections"

afterEach(cleanup)

const check = (name: string, state: Check["state"]): Check => ({
  name,
  state,
  isRequired: true,
  summary: "",
  url: `/o/r/actions/runs/1/job/${name.length}`,
  durationSeconds: 12
})

const note = (where: string, message: string): CheckNote => ({
  level: "failure",
  where,
  message,
  at: Option.none()
})

/** happy-dom lays nothing out, so the rows this test needs are stated outright. */
const layOut = (rects: Record<string, Box>) => {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const found = rects[this.getAttribute(NEAR) ?? "list"] ?? {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    }
    return { ...found, width: 0, height: 0, x: found.left, y: found.top, toJSON: () => "" } as DOMRect
  }
  return () => {
    Element.prototype.getBoundingClientRect = original
  }
}

const spotted = (where: string, message: string, step: number, line: number): CheckNote => ({
  level: "failure",
  where,
  message,
  at: Option.some({ step, line })
})

const logOf = (texts: ReadonlyArray<string>): ReadonlyArray<LogLine> => linesIn(texts.join("\n"))

describe("the log a note points into", () => {
  test("is under the note, with the line it points at marked", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([spotted("Setup Sentrux", "exit code 1", 4, 3)])
    )
    const logs = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Promise.resolve(logOf(["Prepare all required actions", "Cache hit", "the thing that broke"]))
    )

    render(<Checks checks={[check("ci / build", "failed")]} library={library} logs={logs} />)
    await userEvent.click(screen.getByText("ci / build"))

    const marked = await screen.findByText("the thing that broke")
    expect(marked).toBeDefined()
    expect(screen.getByText("Prepare all required actions")).toBeDefined()
    // The line GitHub pointed at is the one wearing the failure colour.
    expect(marked.closest("[class*='bg-fail-muted']")).not.toBeNull()
  })

  test("is asked for by check and step, so two steps are two logs", async () => {
    const asked: Array<string> = []
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([spotted("Setup", "broke", 4, 1), spotted("Install", "broke too", 7, 1)])
    )
    const logs = keptReads<string, ReadonlyArray<LogLine>>((key) => {
      asked.push(key)
      return Promise.resolve(logOf([`log for ${key}`]))
    })

    render(<Checks checks={[check("ci / build", "failed")]} library={library} logs={logs} />)
    await userEvent.click(screen.getByText("ci / build"))

    await waitFor(() => {
      expect(asked).toEqual([
        logKey(check("ci / build", "failed"), 4),
        logKey(check("ci / build", "failed"), 7)
      ])
    })
  })

  test("says nothing extra for a note that points nowhere", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([note("Install dependencies", "exit code 1")])
    )
    const logs = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Promise.resolve(logOf(["should never be asked for"]))
    )

    render(<Checks checks={[check("ci / build", "failed")]} library={library} logs={logs} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("Install dependencies")).toBeDefined()
    expect(screen.queryByText("should never be asked for")).toBeNull()
  })

  test("stays quiet when the log could not be read, leaving the note standing", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([spotted("Setup Sentrux", "exit code 1", 4, 3)])
    )
    const logs = keptReads<string, ReadonlyArray<LogLine>>(() => Promise.reject(new Error("no")))

    render(<Checks checks={[check("ci / build", "failed")]} library={library} logs={logs} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("Setup Sentrux")).toBeDefined()
    await waitFor(() => {
      expect(screen.queryByText(/Reading the log/)).toBeNull()
    })
  })
})

describe("a check no note points into", () => {
  test("opens straight into the end of the log when it failed", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => Promise.resolve([]))
    const tails = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Promise.resolve(logOf(["installing things", "the last thing it said"]))
    )

    render(<Checks checks={[check("ci / build", "failed")]} library={library} tails={tails} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("the last thing it said")).toBeDefined()
  })

  test("opens straight into it when it passed too, since opening it was the ask", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => Promise.resolve([]))
    const tails = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Promise.resolve(logOf(["what the job did"]))
    )

    render(<Checks checks={[check("ci / build", "succeeded")]} library={library} tails={tails} />)
    await userEvent.click(screen.getByText("1 passed"))
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("what the job did")).toBeDefined()
    expect(screen.queryByRole("button", { name: /Read the end of the log/ })).toBeNull()
  })

  test("says so plainly when GitHub keeps no log for it", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => Promise.resolve([]))
    const tails = keptReads<string, ReadonlyArray<LogLine>>(() => Promise.resolve([]))

    render(<Checks checks={[check("ci / build", "failed")]} library={library} tails={tails} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("GitHub keeps no log for this check.")).toBeDefined()
  })

  test("keeps out of the way when a note already points into the log", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([spotted("Setup", "broke", 4, 1)])
    )
    const logs = keptReads<string, ReadonlyArray<LogLine>>(() => Promise.resolve(logOf(["the step log"])))
    const tails = keptReads<string, ReadonlyArray<LogLine>>(() =>
      Promise.resolve(logOf(["the whole log"]))
    )

    render(
      <Checks checks={[check("ci / build", "failed")]} library={library} logs={logs} tails={tails} />
    )
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("the step log")).toBeDefined()
    expect(screen.queryByText("the whole log")).toBeNull()
  })
})

describe("what GitHub wrote against a failing check", () => {
  test("is in the dialog, under the step it happened in", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() =>
      Promise.resolve([note("Setup Sentrux", "The 'client-id' input must be set")])
    )

    render(<Checks checks={[check("ci / build", "failed")]} library={library} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(await screen.findByText("Setup Sentrux")).toBeDefined()
    expect(screen.getByText("The 'client-id' input must be set")).toBeDefined()
  })

  test("says it is reading before it has anything to show", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => new Promise(() => {}))

    render(<Checks checks={[check("ci / build", "failed")]} library={library} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(screen.getByText(/Reading what GitHub said/)).toBeDefined()
  })

  test("is silent when the check said nothing, leaving the log link alone", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => Promise.resolve([]))

    render(<Checks checks={[check("ci / build", "failed")]} library={library} />)
    await userEvent.click(screen.getByText("ci / build"))

    await waitFor(() => {
      expect(screen.queryByText(/Reading what GitHub said/)).toBeNull()
    })
    expect(screen.getByText("Open the full log on GitHub")).toBeDefined()
  })

  test("is silent when the reading failed, rather than showing an error over the link", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>(() => Promise.reject(new Error("no")))

    render(<Checks checks={[check("ci / build", "failed")]} library={library} />)
    await userEvent.click(screen.getByText("ci / build"))

    await waitFor(() => {
      expect(screen.queryByText(/Reading what GitHub said/)).toBeNull()
    })
    expect(screen.getByText("Open the full log on GitHub")).toBeDefined()
  })

  test("belongs to the check that was opened, not the one opened before it", async () => {
    const library = keptReads<string, ReadonlyArray<CheckNote>>((name) =>
      Promise.resolve([note(`step of ${name}`, "said something")])
    )

    render(
      <Checks checks={[check("ci / build", "failed"), check("ci / types", "failed")]} library={library} />
    )
    await userEvent.click(screen.getByText("ci / build"))
    expect(await screen.findByText("step of ci / build")).toBeDefined()

    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    await userEvent.click(screen.getByText("ci / types"))

    expect(await screen.findByText("step of ci / types")).toBeDefined()
    expect(screen.queryByText("step of ci / build")).toBeNull()
  })

  test("is read on the way past, so the click has nothing to wait for", async () => {
    const read = mock(() => Promise.resolve([note("Install dependencies", "exit code 1")]))
    const library = keptReads<string, ReadonlyArray<CheckNote>>(read)
    const putBack = layOut({
      list: { left: 0, top: 0, right: 200, bottom: 200 },
      "ci / build": { left: 0, top: 0, right: 200, bottom: 40 }
    })

    try {
      render(<Checks checks={[check("ci / build", "failed")]} library={library} />)
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 10 }))

      await waitFor(() => {
        expect(read).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(library.held("ci / build")).toBeDefined()
      })

      // Held before the click, so the dialog opens with the words already in it.
      await userEvent.click(screen.getByText("ci / build"))
      expect(screen.queryByText(/Reading what GitHub said/)).toBeNull()
      expect(screen.getByText("Install dependencies")).toBeDefined()
    } finally {
      putBack()
    }
  })

  test("stays out of the way when nothing is wired to read it", async () => {
    render(<Checks checks={[check("ci / build", "failed")]} />)
    await userEvent.click(screen.getByText("ci / build"))

    expect(screen.queryByText(/Reading what GitHub said/)).toBeNull()
    expect(screen.getByText("Open the full log on GitHub")).toBeDefined()
  })
})

describe("a check that has not finished", () => {
  test("turns, the way every other spinner on this page turns", () => {
    render(<Checks checks={[check("ci / build", "running")]} />)

    const turning = screen.queryByLabelText("Running")
    expect(turning?.classList.contains("t-rotate")).toBe(true)
    // GitHub's attention colour, which is the one their own running check wears.
    expect(turning?.classList.contains("text-busy")).toBe(true)
    // GitHub's own shape: a faint ring with a brighter quarter riding it.
    expect(turning?.querySelectorAll("circle, path").length).toBe(2)
  })

  test("waits still while it is only queued, which is not the same thing", () => {
    render(<Checks checks={[check("ci / build", "queued")]} />)

    expect(screen.queryByLabelText("Running")).toBeNull()
  })
})

describe("getting out of the dialog", () => {
  const opened = async () => {
    render(<Checks checks={[check("ci / build", "failed")]} />)
    await userEvent.click(screen.getByText("ci / build"))
    return screen.getByRole("dialog")
  }

  /**
   * As a word rather than as the element: a happy-dom node handed to a failing
   * matcher is printed in full, and "in full" reaches the window through the
   * node's own document and never finishes.
   */
  const dialog = () => (screen.queryByRole("dialog") === null ? "gone" : "open")

  test("closes on Escape, which is the first thing anyone tries", async () => {
    await opened()

    await userEvent.keyboard("{Escape}")

    expect(dialog()).toBe("gone")
  })

  test("closes on a press outside it, which is the second", async () => {
    const frame = await opened()

    // The backdrop is the dialog's own box: a press that lands on the element
    // rather than on anything inside it landed outside the card.
    await userEvent.click(frame)

    expect(dialog()).toBe("gone")
  })

  test("stays open when the press was on something in it", async () => {
    const frame = await opened()

    await userEvent.click(within(frame).getByRole("heading", { name: "ci / build" }))

    expect(dialog()).toBe("open")
  })
})
