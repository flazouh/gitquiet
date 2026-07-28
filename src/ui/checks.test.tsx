import { afterEach, describe, expect, mock, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { keptReads } from "../app/kept"
import type { Check, CheckNote } from "../domain/PullRequest"
import { type Box, NEAR } from "./near"
import { Checks } from "./Sections"

afterEach(cleanup)

const check = (name: string, state: Check["state"]): Check => ({
  name,
  state,
  isRequired: true,
  summary: "",
  url: `/o/r/actions/runs/1/job/${name.length}`,
  durationSeconds: 12
})

const note = (where: string, message: string): CheckNote => ({ level: "failure", where, message })

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
