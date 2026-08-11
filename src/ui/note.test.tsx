import { afterEach, describe, expect, it, mock, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect, Exit } from "effect"
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
    const landing = Deferred.makeUnsafe<void>()
    const onPost = mock(() => Deferred.await(landing))

    render(<Note from={7} to={7} body="" onPost={onPost} onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "This reads twice")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    expect(onPost).toHaveBeenCalledWith("This reads twice")
    const posting = screen.getByRole("button", { name: "Posting…" })
    expect(posting).toBeDefined()
    // And turns while it says it, which is the only part of a wait that says the
    // wait is still going. The room for the circle belongs to the word "Posting…",
    // so the button is this width before the press as well as during it.
    expect(posting.querySelector(".t-rotate")).not.toBeNull()

    Deferred.doneUnsafe(landing, Exit.void)
  })

  test("keeps the words and says what happened when GitHub refuses", async () => {
    const onPost = mock(() => Effect.fail(new Error("line is outside the diff")))

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

  test("marks what is selected on the shortcut, without reaching for the toolbar", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(box, "make this bold")
    box.setSelectionRange(10, 14)

    await userEvent.keyboard("{Meta>}b{/Meta}")

    expect(box.value).toBe("make this **bold**")
  })

  /*
   * Enter under a list carries the list on. Every editor a reader uses does this, GitHub's
   * own box included, and a box that does not makes them type the bullet every time.
   */
  test("carries a list on when Enter is pressed under one", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement

    await userEvent.type(box, "- milk{Enter}eggs")

    expect(box.value).toBe("- milk\n- eggs")
  })

  test("leaves the list when Enter comes under an empty marker", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement

    await userEvent.type(box, "- milk{Enter}{Enter}after")

    expect(box.value).toBe("- milk\n\nafter")
  })

  test("wraps chosen words in an address that is pasted over them", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(box, "read the docs")
    box.setSelectionRange(9, 13)

    await userEvent.paste("https://example.com/docs")

    expect(box.value).toBe("read the [docs](https://example.com/docs)")
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

/**
 * The list under the caret, which is the other half of writing a comment where the reader is.
 *
 * A mention typed from memory is a mention spelled wrong, and a reference typed from memory
 * is a number nobody checked. Their own box offers both, and a box that did not would send
 * people back to their page to write.
 */
describe("offering a name and a number", () => {
  const suggest = () =>
    Effect.succeed({
      people: [
        { login: "flazouh", name: "Alex" },
        { login: "flowline-bot", name: "Flowline" }
      ],
      numbered: [{ number: 77, title: "Closing an issue", state: "open" as const }]
    })

  const box = () =>
    render(<Note from={7} to={7} body="" suggest={suggest} onSave={() => {}} onDiscard={() => {}} />)

  test("offers people once an at sign is typed", async () => {
    box()
    await userEvent.type(screen.getByRole("textbox"), "thanks @fl")

    const offered = await screen.findAllByRole("option")
    expect(offered.map((one) => one.textContent)).toEqual(["@flazouhAlex", "@flowline-botFlowline"])
  })

  test("writes the whole login in, with a space after it", async () => {
    box()
    const field = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(field, "thanks @flaz")
    await userEvent.click(await screen.findByRole("option", { name: /flazouh/ }))

    expect(field.value).toBe("thanks @flazouh ")
  })

  test("offers issues after a hash, by number and by title", async () => {
    box()
    await userEvent.type(screen.getByRole("textbox"), "same as #clos")

    expect((await screen.findAllByRole("option")).map((one) => one.textContent)).toEqual([
      "#77Closing an issue"
    ])
  })

  test("takes the one under the arrows when Enter is pressed", async () => {
    box()
    const field = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(field, "thanks @fl")
    await screen.findAllByRole("option")
    await userEvent.keyboard("{ArrowDown}{Enter}")

    expect(field.value).toBe("thanks @flowline-bot ")
  })

  /*
   * Escape puts the list away and leaves the box open. Anything else would make the key that
   * dismisses a menu the key that throws away a paragraph.
   */
  test("puts the list away on Escape without putting the box away", async () => {
    box()
    const field = screen.getByRole("textbox") as HTMLTextAreaElement
    await userEvent.type(field, "thanks @fl")
    await screen.findAllByRole("option")
    await userEvent.keyboard("{Escape}")

    expect(screen.queryAllByRole("option")).toEqual([])
    expect(field.value).toBe("thanks @fl")
  })

  test("offers nobody where nothing was wired up to offer them", async () => {
    render(<Note from={7} to={7} body="" onSave={() => {}} onDiscard={() => {}} />)
    await userEvent.type(screen.getByRole("textbox"), "thanks @fl")

    expect(screen.queryAllByRole("option")).toEqual([])
  })
})
