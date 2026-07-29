import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type { ChangedFile } from "../domain/PullRequest"
import type { Profile } from "../keys/commands"
import { diffChoices, treeChoices } from "../settings/apply"
import { DEFAULTS } from "../settings/Settings"
import { FileBrowser } from "./FileBrowser"
import { ROOT_ID } from "./mount"
import { SettingsMenu } from "./SettingsMenu"
import { useKeys } from "./useKeys"

afterEach(cleanup)

/** Something modal on the screen, which owns the keyboard while it is there. */
const Modal = () => {
  const frame = useRef<HTMLDialogElement | null>(null)
  useEffect(() => {
    frame.current?.showModal()
  }, [])

  return (
    <dialog ref={frame} aria-label="something modal">
      <p>on top of everything</p>
    </dialog>
  )
}

const Harness = ({ profile = "standard" }: { readonly profile?: Profile }) => {
  const [count, setCount] = useState(0)
  const [out, setOut] = useState(0)
  useKeys(profile, {
    nextFile: () => setCount((held) => held + 1),
    dismiss: () => setOut((held) => held + 1)
  })

  return (
    <div>
      <textarea aria-label="a note" />
      <p>{`moved ${count}, dismissed ${out}`}</p>
    </div>
  )
}

const said = () => screen.getByText(/moved/).textContent

describe("the keyboard, over the whole page", () => {
  test("acts on a key it was given something to do with", async () => {
    render(<Harness />)

    await userEvent.keyboard("j")

    expect(said()).toBe("moved 1, dismissed 0")
  })

  test("stays out of the way while someone is writing", async () => {
    render(<Harness />)

    await userEvent.click(screen.getByLabelText("a note"))
    await userEvent.keyboard("jjj")

    expect(said()).toBe("moved 0, dismissed 0")
    expect(screen.getByLabelText("a note")).toHaveProperty("value", "jjj")
  })

  test("leaves even the way out to whoever owns the box being typed in", async () => {
    // A note discards itself on Escape. If this reached over its head and closed
    // something further out instead, a half-written comment would vanish along
    // with whatever the reader was actually looking at.
    render(<Harness />)

    await userEvent.click(screen.getByLabelText("a note"))
    await userEvent.keyboard("{Escape}")

    expect(said()).toBe("moved 0, dismissed 0")
  })

  test("takes the way out when nothing is being typed in", async () => {
    render(<Harness />)

    await userEvent.keyboard("{Escape}")

    expect(said()).toBe("moved 0, dismissed 1")
  })

  test("steps back while a dialog has the screen", async () => {
    render(
      <>
        <Harness />
        <Modal />
      </>
    )

    await userEvent.keyboard("{Escape}")
    await userEvent.keyboard("j")

    // The dialog is the innermost thing open, so it owns the way out. The page
    // taking Escape first closed whatever was behind the dialog and left the
    // dialog itself sitting there.
    expect(said()).toBe("moved 0, dismissed 0")
  })

  test("has the keyboard back once the dialog has gone", async () => {
    const { rerender } = render(
      <>
        <Harness />
        <Modal />
      </>
    )
    rerender(<Harness />)

    await userEvent.keyboard("{Escape}")

    expect(said()).toBe("moved 0, dismissed 1")
  })

  test("leaves the way out in the air for the menu that is open to take", async () => {
    const Page = () => {
      useKeys("standard", { dismiss: () => {} })
      return <SettingsMenu settings={DEFAULTS} onChange={() => {}} />
    }
    render(<Page />)
    await userEvent.click(screen.getByLabelText("Display settings"))
    expect(screen.queryByRole("menu") === null).toBe(false)

    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("menu") === null).toBe(true)
  })

  test("answers a key pressed before the interface has said where it is", async () => {
    // The scope arrives one render late: it is an element, and an element is
    // only known once React has put it on the screen. Until then this fell back
    // to asking the whole page whether anything was open, and GitHub's page
    // carries two dozen menus at all times whether or not any is showing — so a
    // key pressed in the first moments of a page went nowhere, and the press
    // that "worked" was the second one.
    const theirs = document.createElement("div")
    theirs.innerHTML = '<details-menu role="menu">Copy link</details-menu>'
    document.body.append(theirs)

    const ours = document.createElement("div")
    ours.id = ROOT_ID
    document.body.append(ours)

    try {
      render(<Harness />, { container: ours })
      await userEvent.keyboard("j")

      expect(said()).toBe("moved 1, dismissed 0")
    } finally {
      theirs.remove()
      ours.remove()
    }
  })

  test("does nothing for a command nothing was wired to", async () => {
    render(<Harness />)

    await userEvent.keyboard("k")

    expect(said()).toBe("moved 0, dismissed 0")
  })

  test("does nothing at all with the keyboard turned off", async () => {
    render(<Harness profile="off" />)

    await userEvent.keyboard("j")

    expect(said()).toBe("moved 0, dismissed 0")
  })
})

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 2,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

describe("moving through files that arrived after the panel did", () => {
  test("goes to the second file on the first press, not the one already open", async () => {
    // The panel is drawn before GitHub has answered about the pull request, so
    // its first render has no files in it at all. Nothing chose the first file
    // — it is simply what is shown when nothing is chosen — and "the one after
    // the chosen one" was then the first file itself: the press did happen, and
    // moved from the file on screen to the file on screen.
    const { rerender } = render(
      <FileBrowser
        files={[]}
        fetchDiffs={async () => []}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )

    rerender(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={async () => []}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )
    await waitFor(() => expect(screen.getByLabelText("Open file").textContent).toContain("one.ts"))

    await userEvent.keyboard("j")

    expect(screen.getByLabelText("Open file").textContent).toContain("two.ts")
  })

  test("counts the file it is showing as read, nobody having chosen it", async () => {
    const { rerender } = render(
      <FileBrowser
        files={[]}
        fetchDiffs={async () => []}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )

    rerender(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={async () => []}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )

    await waitFor(() => expect(screen.getByText("1 of 2 seen")).toBeDefined())
  })
})

const browsing = (keys: Profile = "standard") =>
  render(
    <FileBrowser
      files={[file("src/one.ts"), file("src/two.ts")]}
      fetchDiffs={async () => []}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys={keys}
    />
  )

const open = () => screen.getByLabelText("Open file").textContent

describe("moving through the files without the mouse", () => {
  test("goes on to the next file and back again", async () => {
    browsing()

    await userEvent.keyboard("j")
    expect(open()).toContain("two.ts")

    await userEvent.keyboard("k")
    expect(open()).toContain("one.ts")
  })

  test("stops at the ends rather than wrapping round", async () => {
    browsing()

    await userEvent.keyboard("k")
    expect(open()).toContain("one.ts")

    await userEvent.keyboard("jjj")
    expect(open()).toContain("two.ts")
  })

  test("leaves the keys alone for a reader who turned them off", async () => {
    browsing("off")

    await userEvent.keyboard("j")

    expect(open()).toContain("one.ts")
  })
})

/** A pull request the size of a real one, nested the way real ones are. */
const manyFiles = (): ReadonlyArray<ChangedFile> => [
  file("docs/rfcs/0003-runtime-architecture/interactive-request-lifecycle.md"),
  file("framework/adapters/adapter-pi-acp/src/projection/elicitation.test.ts"),
  file("framework/adapters/adapter-pi-acp/src/projection/elicitation.ts"),
  ...Array.from({ length: 30 }, (_, at) =>
    file(`framework/engine/selected-adapter/src/part-${String(at).padStart(2, "0")}.ts`)
  )
]

const deepBrowsing = () =>
  render(
    <FileBrowser
      files={manyFiles()}
      fetchDiffs={async () => []}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys="standard"
    />
  )

describe("moving through a pull request the size of a real one", () => {
  test("still goes on to the next file when the tree is deep and folded", async () => {
    deepBrowsing()
    expect(open()).toContain("interactive-request-lifecycle.md")

    await userEvent.keyboard("j")

    expect(open()).toContain("elicitation.test.ts")
  })

  test("keeps going, rather than sticking on the file it started from", async () => {
    deepBrowsing()

    await userEvent.keyboard("jj")

    expect(open()).toContain("elicitation.ts")
  })
})

const button = (name: RegExp) => screen.getByRole("button", { name })

describe("saying which key does the same thing as the button", () => {
  test("writes the key on the button that does the same work", () => {
    browsing()

    expect(button(/Next file/).textContent).toContain("j")
    expect(button(/Next file/).getAttribute("aria-keyshortcuts")).toBe("j")
    expect(button(/Previous/).textContent).toContain("k")
  })

  test("says what the vim reader's keys are, since they are the same two buttons", () => {
    browsing("vim")

    expect(button(/Next file/).textContent).toContain("j")
    expect(button(/Previous/).textContent).toContain("k")
  })

  test("promises nothing to a reader with the keyboard turned off", () => {
    browsing("off")

    expect(button(/Next file/).textContent).not.toContain("j")
    expect(button(/Next file/).getAttribute("aria-keyshortcuts")).toBeNull()
  })
})
