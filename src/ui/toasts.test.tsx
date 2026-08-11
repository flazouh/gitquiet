import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { done, freshening, SETTLED, Toasts, refused } from "./Toasts"

afterEach(cleanup)

describe("what the interface says when GitHub says no", () => {
  test("says it, where the reader is already looking", async () => {
    render(<Toasts />)

    act(() => refused("The head branch has been deleted"))

    await waitFor(() =>
      expect(screen.getByText("The head branch has been deleted")).toBeDefined()
    )
  })

  test("stands in the corner, out of the way of the list it is reporting on", async () => {
    /*
     * It used to stand at the top centre, which is where the reader is working and, on
     * GitHub's page, where our own bar is. Right because the Rail is on the left in both
     * shells; bottom because a list grows downwards, so the newest row is never covered.
     */
    render(<Toasts />)

    act(() => refused("GitHub said no"))

    await waitFor(() => expect(document.querySelector("[data-sonner-toaster]")).not.toBeNull())

    const toaster = document.querySelector("[data-sonner-toaster]")

    expect(toaster?.getAttribute("data-y-position")).toBe("bottom")
    expect(toaster?.getAttribute("data-x-position")).toBe("right")
  })

  test("wears this interface's own surface rather than sonner's", async () => {
    render(<Toasts />)

    act(() => refused("GitHub would not reopen this"))

    await waitFor(() => expect(document.querySelector("[data-sonner-toast]")).toBeDefined())

    const toast = document.querySelector("[data-sonner-toast]")

    // The tokens, not the palette: both shells answer these names, and in the
    // extension they are the reader's own GitHub theme.
    expect(toast?.className).toContain("bg-raised")
    expect(toast?.className).toContain("shadow-pop")

    // And no edge, said rather than left out. Sonner's own rule is `border: 1px solid
    // var(--normal-border)`, which at `theme="light"` is `#ededed`: a near-white line
    // around a dark panel on GitHub's page. Dropping our `border-line` class left
    // theirs unopposed, so the class has to name the absence.
    expect(toast?.className).toContain("!border-0")
  })

  test("hangs outside our root, where a z-index still means something", async () => {
    /*
     * GitHub wraps their page in `div.logged-in { isolation: isolate }`, so Sonner's
     * `z-index: 999999999` was being sorted inside a context that itself sits under
     * the bar — a sticky slot in `document.body` at thirty. The toast drew behind the
     * glass. The fix is where it is mounted, not what number it asks for.
     */
    const { container } = render(
      <div id="gitquiet-root">
        <Toasts />
      </div>
    )

    act(() => refused("GitHub said no"))

    await waitFor(() => expect(document.querySelector("[data-sonner-toaster]")).not.toBeNull())

    const toaster = document.querySelector("[data-sonner-toaster]")

    expect(container.querySelector("[data-sonner-toaster]")).toBeNull()
    expect(toaster?.closest("#gitquiet-root")).toBeNull()
    // In one of the marked hosts, which is what the stylesheet and the theme look for.
    expect(toaster?.closest("[data-gitquiet-outside]")?.id).toBe("gitquiet-over")
  })

  test("one to a document, however many times the shell wraps itself", async () => {
    // Which is what both shells do: the window wraps its screens and each screen
    // wraps itself again, and three toasters stacked in one place drew every
    // refusal three times over.
    render(
      <Toasts>
        <Toasts>
          <Toasts>
            <span>the list</span>
          </Toasts>
        </Toasts>
      </Toasts>
    )

    act(() => refused("GitHub would not close this"))

    await waitFor(() => expect(document.querySelector("[data-sonner-toaster]")).not.toBeNull())

    expect(document.querySelectorAll("[data-sonner-toaster]")).toHaveLength(1)
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(1)
    expect(screen.getByText("the list")).toBeDefined()
  })
})

describe("what the interface says when it did the thing", () => {
  test("says what landed", async () => {
    render(<Toasts />)

    act(() => done("flazouh/octo-repo#12 closed"))

    await waitFor(() => expect(screen.getByText("flazouh/octo-repo#12 closed")).toBeDefined())
  })

  test("carries the way back, where the verb has one", async () => {
    const back: Array<string> = []
    render(<Toasts />)

    act(() => done("flazouh/octo-repo#12 closed", { said: "Undo", go: () => back.push("gone back") }))

    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeDefined())
    await userEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(back).toEqual(["gone back"])
  })

  test("no way back offered where there is none, rather than one that refuses", async () => {
    render(<Toasts />)

    act(() => done("flazouh/octo-repo#12 merged"))

    await waitFor(() => expect(screen.getByText("flazouh/octo-repo#12 merged")).toBeDefined())

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })
})

describe("what the interface says while it is reading, and when the read lands", () => {
  test("answers its own sentence: the spinner becomes a check and a word", async () => {
    /*
     * One toast, twice. A loading sentence that is dismissed leaves a reader who watched
     * something spin at the top of the screen with no idea whether it finished or gave up —
     * and the list underneath cannot say, because a list that was already right does not
     * change when the read agrees with it. So the same toast answers itself.
     */
    render(<Toasts />)

    const reading = freshening("Checking your pull requests…")

    await waitFor(() => expect(screen.getByText("Checking your pull requests…")).toBeDefined())

    act(() => reading.landed())

    await waitFor(() => expect(screen.getByText("Up to date")).toBeDefined())

    // In place, rather than a second toast under the first.
    expect(document.querySelectorAll('[data-sonner-toast]:not([data-removed="true"])')).toHaveLength(
      1
    )
    // And the check draws itself, which is the only part of this a reader watches.
    expect(document.querySelector(".t-drawn")).not.toBeNull()
  })

  test("goes on its own once it has said so, unlike the sentence before it", async () => {
    render(<Toasts />)

    const reading = freshening("Checking your repositories…")
    await waitFor(() => expect(screen.getByText("Checking your repositories…")).toBeDefined())

    act(() => reading.landed())
    await waitFor(() => expect(screen.getByText("Up to date")).toBeDefined())

    await act(() => new Promise((rest) => setTimeout(rest, SETTLED + 400)))

    expect(
      document.querySelectorAll('[data-sonner-toast]:not([data-removed="true"])')
    ).toHaveLength(0)
  })

  test("comes down with no verdict where the read never landed", async () => {
    // The screen went away, or the sentence changed. Neither is an answer, and "Up to date"
    // about a read that was abandoned is a lie the reader would act on.
    render(<Toasts />)

    const reading = freshening("Checking what has happened…")
    await waitFor(() => expect(screen.getByText("Checking what has happened…")).toBeDefined())

    act(() => reading.take())

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-sonner-toast]:not([data-removed="true"])')
      ).toHaveLength(0)
    )
    expect(screen.queryByText("Up to date")).toBeNull()
  })
})
