import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { useEffect, useRef, useState } from "react"
import { afterwards } from "../../tests/afterwards"
import type { ChangedFile } from "../domain/PullRequest"
import type { Profile } from "../keys/commands"
import { PATIENCE } from "../keys/match"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS } from "../domain/Settings"
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

/**
 * The presses the operating system sends while a key stays down.
 *
 * Raw, because `userEvent` has no way to say `repeat`: it dispatches held keys
 * as a run of first presses, which is the one thing a held key is not.
 */
const held = async (key: string, times: number): Promise<void> => {
  for (let count = 0; count < times; count += 1) {
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true })
      )
    })
  }
}

describe("the keyboard, over the whole page", () => {
  const undo = afterwards()

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
    undo(() => theirs.remove())

    const ours = document.createElement("div")
    ours.id = ROOT_ID
    document.body.append(ours)
    undo(() => ours.remove())

    render(<Harness />, { container: ours })
    await userEvent.keyboard("j")

    expect(said()).toBe("moved 1, dismissed 0")
  })

  test("keeps moving for as long as the key is held down", async () => {
    render(<Harness />)

    await userEvent.keyboard("j")
    await held("j", 3)

    expect(said()).toBe("moved 4, dismissed 0")
  })

  test("takes a held key for moving and for nothing else", async () => {
    // The way out is the case that shows why. Escape closes what is open, and
    // one held for half a second would close the dialog, then whatever the
    // dialog was opened from, then the panel behind that.
    render(<Harness />)

    await held("Escape", 3)

    expect(said()).toBe("moved 0, dismissed 0")
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

/** A page listening for the Destinations, which are two keys each. */
const Going = () => {
  const [went, setWent] = useState<ReadonlyArray<string>>([])
  const [moved, setMoved] = useState(0)
  const reach = (where: string) => () => setWent((held) => [...held, where])
  useKeys("standard", {
    workingSet: reach("the Working Set"),
    repositories: reach("Repositories"),
    activity: reach("Activity"),
    home: reach("Home"),
    nextFile: () => setMoved((held) => held + 1)
  })

  return (
    <div>
      <textarea aria-label="a note" />
      <p>{`went to ${went.join(", ")}; moved ${moved}`}</p>
    </div>
  )
}

const going = () => screen.getByText(/went to/).textContent

describe("reaching a Destination with two keys", () => {
  const undo = afterwards()

  test("goes where the sequence says", async () => {
    render(<Going />)

    await userEvent.keyboard("gd")

    expect(going()).toBe("went to the Working Set; moved 0")
  })

  test("has one sequence for each of the three, and one for Home", async () => {
    render(<Going />)

    await userEvent.keyboard("grgfgh")

    expect(going()).toBe("went to Repositories, Activity, Home; moved 0")
  })

  test("goes nowhere on the leader alone", async () => {
    render(<Going />)

    await userEvent.keyboard("g")

    expect(going()).toBe("went to ; moved 0")
  })

  test("takes the leader out of the air, and leaves the key after it in", async () => {
    // GitHub's own sequences start on `g` too, so the leader has to be taken
    // before their handlers see it. What follows an abandoned one is not ours,
    // and reaches the page exactly as it would have.
    const seen: Array<string> = []
    const watch = (event: KeyboardEvent) => seen.push(event.key)
    document.addEventListener("keydown", watch)
    undo(() => document.removeEventListener("keydown", watch))
    render(<Going />)

    await userEvent.keyboard("gx")

    expect(seen).toEqual(["x"])
    expect(going()).toBe("went to ; moved 0")
  })

  test("moves through the files again after a sequence came to nothing", async () => {
    render(<Going />)

    await userEvent.keyboard("gxj")

    expect(going()).toBe("went to ; moved 1")
  })

  test("has forgotten a sequence the reader left half typed", async () => {
    setSystemTime(new Date("2026-01-01T09:00:00Z"))
    undo(() => setSystemTime())
    render(<Going />)

    await userEvent.keyboard("g")
    setSystemTime(new Date(Date.now() + PATIENCE + 1))
    await userEvent.keyboard("d")

    expect(going()).toBe("went to ; moved 0")
  })

  test("gives up on a sequence another part of the page answered in the middle of", async () => {
    // Two panels bind the keyboard at once here, as they do on a real screen.
    // A `g` left pending through a press somebody else took would be finished
    // by whatever the reader typed next, which is a Destination nobody asked
    // for.
    const Files = () => {
      const [moved, setMoved] = useState(0)
      useKeys("standard", { nextFile: () => setMoved((held) => held + 1) })
      return <p>{`files moved ${moved}`}</p>
    }
    // The files panel binds the keyboard first, so it is the one that answers
    // the `j` and takes it out of the air before this hook has read it.
    render(
      <>
        <Files />
        <Going />
      </>
    )

    await userEvent.keyboard("gjd")

    expect(going()).toBe("went to ; moved 0")
    expect(screen.getByText(/files moved/).textContent).toBe("files moved 1")
  })

  test("stays out of the way while someone is writing a sequence into a box", async () => {
    render(<Going />)

    await userEvent.click(screen.getByLabelText("a note"))
    await userEvent.keyboard("gd")

    expect(going()).toBe("went to ; moved 0")
    expect(screen.getByLabelText("a note")).toHaveProperty("value", "gd")
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
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )

    rerender(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={() => Effect.succeed([])}
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
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        keys="standard"
      />
    )

    rerender(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={() => Effect.succeed([])}
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
      fetchDiffs={() => Effect.succeed([])}
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

  test("comes round to the first file after the last", async () => {
    browsing()

    await userEvent.keyboard("jj")

    expect(open()).toContain("one.ts")
  })

  test("goes round to the last file from the first", async () => {
    browsing()

    await userEvent.keyboard("k")

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
  file("docs/rfcs/0003-architecture/request-lifecycle.md"),
  file("packages/adapters/adapter-rpc/src/projection/elicitation.test.ts"),
  file("packages/adapters/adapter-rpc/src/projection/elicitation.ts"),
  ...Array.from({ length: 30 }, (_, at) =>
    file(`packages/engine/selected-adapter/src/part-${String(at).padStart(2, "0")}.ts`)
  )
]

const deepBrowsing = () =>
  render(
    <FileBrowser
      files={manyFiles()}
      fetchDiffs={() => Effect.succeed([])}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
      keys="standard"
    />
  )

describe("moving through a pull request the size of a real one", () => {
  test("still goes on to the next file when the tree is deep and folded", async () => {
    deepBrowsing()
    expect(open()).toContain("request-lifecycle.md")

    await userEvent.keyboard("j")

    expect(open()).toContain("elicitation.test.ts")
  })

  test("keeps going, rather than sticking on the file it started from", async () => {
    deepBrowsing()

    await userEvent.keyboard("jj")

    expect(open()).toContain("elicitation.ts")
  })

  test("spins through the list under one held key", async () => {
    deepBrowsing()

    await userEvent.keyboard("j")
    await held("j", 3)

    expect(open()).toContain("part-01.ts")
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
