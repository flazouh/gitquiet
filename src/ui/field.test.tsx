import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { Field } from "./Field"

afterEach(cleanup)

const Typing = ({ onDone }: { readonly onDone?: () => void }) => {
  const [value, setValue] = useState("")
  return <Field value={value} onChange={setValue} label="Find a file" art="search" onDone={onDone} />
}

describe("the field every filter in this interface is", () => {
  test("says what it invites, to a reader and to a screen reader both", () => {
    render(<Typing />)

    const field = screen.getByLabelText("Find a file")
    expect(field.getAttribute("placeholder")).toBe("Find a file")
  })

  test("keeps a keystroke inside our interface, away from GitHub's letters", async () => {
    // Their page binds single letters across the whole document — `t` opens the
    // file finder — and a keystroke reaches them by bubbling out of our root.
    // Typing `t` in a filter of ours used to open their finder.
    const heard: Array<string> = []
    const listen = (event: KeyboardEvent) => heard.push(event.key)
    document.addEventListener("keydown", listen)

    render(<Typing />)
    await userEvent.type(screen.getByLabelText("Find a file"), "t")
    document.removeEventListener("keydown", listen)

    expect(heard).toEqual([])
    expect((screen.getByLabelText("Find a file") as HTMLInputElement).value).toBe("t")
  })

  test("empties itself on Escape rather than leaving a filter nobody can see", async () => {
    render(<Typing />)
    const field = screen.getByLabelText("Find a file") as HTMLInputElement

    await userEvent.type(field, "readme")
    expect(field.value).toBe("readme")

    await userEvent.type(field, "{Escape}")
    expect(field.value).toBe("")
  })

  test("tells the panel it belongs to, once it is empty", async () => {
    let told = 0
    render(<Typing onDone={() => (told += 1)} />)

    await userEvent.type(screen.getByLabelText("Find a file"), "{Escape}")

    expect(told).toBe(1)
  })

  /*
   * The key a form is sent with, answered here because this field stops every
   * keystroke reaching the rest of the document — see the note on the component.
   */
  test("sends, where it is part of something being sent", async () => {
    let sent = 0
    render(
      <Field
        value="a title"
        onChange={() => {}}
        label="What happened, in one line"
        onSend={() => (sent += 1)}
      />
    )

    const field = screen.getByLabelText("What happened, in one line")
    await userEvent.type(field, "{Meta>}{Enter}{/Meta}")

    expect(sent).toBe(1)
  })

  test("does not send on Enter alone, which a one-line field would swallow anyway", async () => {
    let sent = 0
    render(
      <Field value="a title" onChange={() => {}} label="Find a file" onSend={() => (sent += 1)} />
    )

    await userEvent.type(screen.getByLabelText("Find a file"), "{Enter}")

    expect(sent).toBe(0)
  })

  test("is not somewhere a tab lands while the surface holding it is leaving", () => {
    render(
      <Field value="" onChange={() => {}} label="Find a branch" reachable={false} />
    )

    expect(screen.getByLabelText("Find a branch").getAttribute("tabindex")).toBe("-1")
  })
})
