import { afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { lineLabel, Note } from "./Note"

afterEach(cleanup)

describe("a note on some lines", () => {
  it("names one line and a range differently", () => {
    expect(lineLabel(12, 12)).toBe("Line 12")
    expect(lineLabel(12, 14)).toBe("Lines 12 to 14")
  })

  it("opens as a box to type in when nothing is written yet", () => {
    render(<Note from={12} to={14} body="" onSave={mock()} onDiscard={mock()} />)

    expect(screen.getByRole("textbox")).toBeTruthy()
    expect(screen.getByText("Lines 12 to 14")).toBeTruthy()
  })

  it("will not save an empty comment", () => {
    render(<Note from={12} to={12} body="" onSave={mock()} onDiscard={mock()} />)

    const save = screen.getByRole("button", { name: "Save draft" })
    expect((save as HTMLButtonElement).disabled).toBe(true)
  })

  it("hands back what was written, without the whitespace around it", async () => {
    const onSave = mock()
    render(<Note from={12} to={12} body="" onSave={onSave} onDiscard={mock()} />)

    await userEvent.type(screen.getByRole("textbox"), "  Two things.  ")
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    expect(onSave).toHaveBeenCalledWith("Two things.")
  })

  it("settles into what was written, and says it has not been posted", () => {
    render(<Note from={12} to={12} body="Two things." onSave={mock()} onDiscard={mock()} />)

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByText("Two things.")).toBeTruthy()
    expect(screen.getByText("Draft, not posted")).toBeTruthy()
  })

  it("opens again to be edited", async () => {
    render(<Note from={12} to={12} body="Two things." onSave={mock()} onDiscard={mock()} />)

    await userEvent.click(screen.getByRole("button", { name: "Edit" }))
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Two things.")
  })

  it("lets go on escape", async () => {
    const onDiscard = mock()
    render(<Note from={12} to={12} body="" onSave={mock()} onDiscard={onDiscard} />)

    await userEvent.type(screen.getByRole("textbox"), "{Escape}")
    expect(onDiscard).toHaveBeenCalled()
  })
})
