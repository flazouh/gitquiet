import { afterEach, describe, expect, it, mock, test } from "bun:test"
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

describe("sending a remark to GitHub", () => {
  test("posts what was written, and says so while it is going", async () => {
    let land = (): void => {}
    const posting = new Promise<void>((resolve) => {
      land = resolve
    })
    const onPost = mock(() => posting)

    render(<Note from={7} to={7} body="" onPost={onPost} onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "This reads twice")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    expect(onPost).toHaveBeenCalledWith("This reads twice")
    expect(screen.getByRole("button", { name: "Posting…" })).toBeDefined()

    land()
  })

  test("keeps the words and says what happened when GitHub refuses", async () => {
    const onPost = mock(() => Promise.reject(new Error("line is outside the diff")))

    render(<Note from={7} to={7} body="" onPost={onPost} onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "Worth keeping")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    expect(await screen.findByText(/line is outside the diff/)).toBeDefined()
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Worth keeping")
  })

  test("cannot be posted where nothing is wired up to post it", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "Nowhere to go")

    expect((screen.getByRole("button", { name: "Comment" }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  test("is signed by whoever is writing it", () => {
    render(
      <Note
        from={7}
        to={7}
        body=""
        viewer={{ login: "flazouh" }}
        onSave={() => {}}
        onDiscard={() => {}}
      />
    )

    expect(screen.getByLabelText("flazouh")).toBeDefined()
  })
})

describe("writing it in markdown", () => {
  test("shows what the words will look like once they are posted", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "A `call` to make")
    await userEvent.click(screen.getByRole("button", { name: "Preview" }))

    expect(screen.getByText("call").tagName).toBe("CODE")
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  test("says there is nothing to preview rather than showing an empty box", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.click(screen.getByRole("button", { name: "Preview" }))

    expect(screen.getByText("Nothing to preview yet.")).toBeDefined()
  })

  test("wraps what is selected when a mark is pressed", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(box, "make this bold")
    box.setSelectionRange(10, 14)

    await userEvent.click(screen.getByLabelText("Bold"))

    expect(box.value).toBe("make this **bold**")
  })

  test("puts a quote at the front of the line the caret is in", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(box, "said elsewhere")

    await userEvent.click(screen.getByLabelText("Quote"))

    expect(box.value).toBe("> said elsewhere")
  })

  test("renders a saved draft as the markdown it is", () => {
    render(<Note from={7} to={7} body="a **strong** point" onSave={() => {}} onDiscard={() => {}} />)

    expect(screen.getByText("strong").tagName).toBe("STRONG")
  })
})
