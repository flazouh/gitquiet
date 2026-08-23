import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices, treeChoices } from "../domain/choices"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { FileBrowser, type FileBrowserProps } from "./FileBrowser"

afterEach(cleanup)

const file = (path: string): ChangedFile => ({
  path,
  digest: `${path}-digest`,
  changeType: "modified",
  linesAdded: 41,
  linesDeleted: 5,
  readByViewer: false,
  diff: Option.some({ isBinary: false, isTruncated: false, lines: [] })
})

const classes = (node: Element): ReadonlyArray<string> =>
  (node as HTMLElement).className.split(/\s+/).filter(Boolean)

const draw = () =>
  render(
    <FileBrowser
      files={[file("src/runtime/index.ts")]}
      fetchDiffs={() => Effect.succeed([])}
      diff={diffChoices(DEFAULTS.diff)}
      tree={treeChoices(DEFAULTS.tree)}
    />
  )

describe("one card, one header, two subcards", () => {
  test("the header spans both subcards", () => {
    draw()

    const files = screen.getByLabelText("Files")
    expect(classes(files)).toContain("bg-surface")

    // The band is the card's own first row, above the pair, and it holds the
    // facts about the whole set: how many files, how far in, where next.
    const band = files.firstElementChild as HTMLElement
    expect(classes(band)).toContain("shrink-0")
    expect(within(band).getByText(/1 changed/)).toBeDefined()
    expect(within(band).getByText(/1 of 1 seen/)).toBeDefined()
    expect(within(band).getByRole("button", { name: /Next file/ })).toBeDefined()
  })

  test("the two subcards are the same shape, tops flush", () => {
    draw()

    const files = screen.getByLabelText("Files")
    const row = [...files.querySelectorAll("div")].find((node) =>
      classes(node).includes("@container")
    )
    expect(row).toBeDefined()

    const cards = [...(row?.children ?? [])].filter((node) => {
      const names = classes(node)
      return names.includes("rounded-md") && names.includes("bg-canvas")
    })
    expect(cards).toHaveLength(2)

    const [tree, diff] = cards as [HTMLElement, HTMLElement]
    for (const card of [tree, diff]) {
      const names = classes(card)
      expect(names).toContain("flex")
      expect(names).toContain("flex-col")
      expect(names).toContain("overflow-hidden")
      // A vertical offset on one subcard alone starts it lower than the other.
      expect(names.some((one) => /^py-\d/.test(one))).toBe(false)
    }

    // No header of its own in either subcard; the name of the open file is the
    // one exception, because it names what is under it.
    expect(within(diff).getByLabelText("Open file")).toBeDefined()
    expect(within(tree).queryByLabelText("Open file")).toBeNull()
    expect(within(tree).queryByText(/1 changed/)).toBeNull()

    // The tree is a direct flex child of its subcard. A virtualised host with
    // no height draws no rows.
    const treeBody = tree.firstElementChild as HTMLElement
    expect(classes(treeBody)).toContain("flex-1")
    expect(classes(treeBody)).toContain("min-h-0")
  })
})

/*
 * A pull request of nine hundred lines where seven hundred are a table of cases is a
 * small change and a long proof, and the reader deciding whether to open it now is
 * asking for the first number. The total on its own answers a question nobody has.
 */
describe("how big the change is, once its proof is set aside", () => {
  const sized = (path: string, added: number, deleted: number): ChangedFile => ({
    ...file(path),
    linesAdded: added,
    linesDeleted: deleted
  })

  const band = (files: ReadonlyArray<ChangedFile>, tree = treeChoices(DEFAULTS.tree)) => {
    render(
      <FileBrowser
        files={files}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={tree}
      />
    )
    return within(screen.getByLabelText("Files").firstElementChild as HTMLElement)
  }

  test("counts the whole pull request, and offers to set its proof aside", () => {
    const row = band([
      sized("src/domain/checks.ts", 40, 10),
      sized("src/domain/checks.test.ts", 300, 5)
    ])

    expect(row.getByText(/2 changed/)).toBeDefined()
    expect(row.getByText("+340")).toBeDefined()
    expect(row.getByText("−15")).toBeDefined()
    // What is being offered, on the face of the switch and in what it says on
    // a hover: the word says the state, the title says the size of the proof.
    expect(row.getByText("tests shown")).toBeDefined()
    expect(row.getByRole("button", { name: "Hide the test files" }).title).toContain(
      "1 file, +300 −5"
    )
  })

  /*
   * The word is what tells a reader the counts are the whole of it, and it costs
   * the same width pressed as unpressed, so nothing in the band moves on a press.
   * A pull request with no tests has nothing to say about them and no switch: the
   * counts are then a line of text.
   */
  test("says nothing about tests where none were touched", () => {
    const row = band([sized("src/domain/checks.ts", 40, 10)])

    expect(row.queryByText(/tests/)).toBeNull()
    expect(row.queryByRole("button", { name: /the test files/ })).toBeNull()
  })

  test("takes the test files out of the rail on a press, and puts them back", async () => {
    const row = band([
      sized("src/domain/checks.ts", 40, 10),
      sized("src/domain/checks.test.ts", 300, 5)
    ])

    // The rail itself is a web component and draws nothing here, so what it holds
    // is read off the two things that follow it: how many files the band counts,
    // and which file the pane opens on.
    const open = () => screen.getByLabelText("Open file").textContent ?? ""
    const press = () => row.getByRole("button", { name: /the test files/ })
    expect(open()).toContain("checks.test.ts")

    await userEvent.click(press())

    expect(row.getByText(/1 changed/)).toBeDefined()
    expect(open()).toContain("checks.ts")
    expect(open()).not.toContain("checks.test.ts")
    expect(press().getAttribute("aria-pressed")).toBe("true")
    expect(row.getByText("tests aside")).toBeDefined()

    await userEvent.click(press())

    expect(row.getByText(/2 changed/)).toBeDefined()
    expect(press().getAttribute("aria-pressed")).toBe("false")
    expect(row.getByText("tests shown")).toBeDefined()
  })

  /* Pressed, the counts are the counts of the change alone: one set of numbers,
     saying what the rail is showing, whichever way the switch is turned. */
  test("counts what is left once the tests are aside", async () => {
    const row = band([
      sized("src/domain/checks.ts", 40, 10),
      sized("src/domain/checks.test.ts", 300, 5)
    ])

    await userEvent.click(row.getByRole("button", { name: "Hide the test files" }))

    expect(row.getByText(/1 changed/)).toBeDefined()
    expect(row.getByText("+40")).toBeDefined()
    expect(row.getByText("−10")).toBeDefined()
    expect(row.queryByText("+340")).toBeNull()
    expect(row.getByRole("button", { name: "Show the test files" })).toBeDefined()
  })

  /*
   * Remembered rather than pressed again on every pull request: the switch in the
   * band and the row in the menu are two hands on one knob, so the press writes the
   * setting rather than a state of its own.
   */
  test("writes the choice where the settings menu writes it", async () => {
    const wrote: Array<Settings> = []
    render(
      <FileBrowser
        files={[sized("src/domain/checks.ts", 40, 10), sized("src/domain/checks.test.ts", 300, 5)]}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        display={{ settings: DEFAULTS, onChange: (settings) => wrote.push(settings) }}
      />
    )
    const row = within(screen.getByLabelText("Files").firstElementChild as HTMLElement)

    await userEvent.click(row.getByRole("button", { name: "Hide the test files" }))

    expect(wrote.map((one) => one.tree.tests)).toEqual(["aside"])
  })

  test("opens with the tests aside where that is what was stored", () => {
    const row = band(
      [sized("src/domain/checks.ts", 40, 10), sized("src/domain/checks.test.ts", 300, 5)],
      treeChoices({ ...DEFAULTS.tree, tests: "aside" })
    )

    expect(row.getByText(/1 changed/)).toBeDefined()
    expect(row.getByRole("button", { name: "Show the test files" })).toBeDefined()
  })

  /*
   * A rail with no rows, and the switch that emptied it gone with them, is a dead end:
   * the reader is left guessing what took their files away. So the switch is offered
   * only where pressing it leaves something to read.
   */
  /* The count and the total have to be counting the same set, or the bar reads 2 of 2. */
  test("counts the progress against what is left on the rail", async () => {
    const row = band([
      sized("src/domain/checks.test.ts", 300, 5),
      sized("src/domain/checks.ts", 40, 10),
      sized("README.md", 3, 1)
    ])

    expect(row.getByText(/1 of 3 seen/)).toBeDefined()

    await userEvent.click(row.getByRole("button", { name: "Hide the test files" }))

    expect(row.getByText(/of 2 seen/)).toBeDefined()
    expect(row.queryByText(/2 of 2 seen/)).toBeNull()
  })

  /* Put all back is about the pull request, and says so on its own face. */
  test("puts back the files it is hiding as well", async () => {
    const row = band([
      sized("src/domain/checks.ts", 40, 10),
      sized("src/domain/checks.test.ts", 300, 5)
    ])

    await userEvent.click(row.getByRole("button", { name: "Hide the test files" }))
    await userEvent.click(row.getByRole("button", { name: "Put all back" }))
    await userEvent.click(row.getByRole("button", { name: "Show the test files" }))

    expect(row.getByText(/0 of 2 seen/)).toBeDefined()
  })

  /*
   * A file named somewhere else is about the pull request, not about the rail, so a
   * reader sent to a test file while the tests are hidden is shown that file.
   */
  test("brings the tests back for a file asked for by name", async () => {
    const files = [
      sized("src/domain/checks.ts", 40, 10),
      sized("src/domain/checks.test.ts", 300, 5)
    ]
    const drawn = render(
      <FileBrowser
        files={files}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
      />
    )
    const row = () => within(screen.getByLabelText("Files").firstElementChild as HTMLElement)

    await userEvent.click(row().getByRole("button", { name: "Hide the test files" }))

    drawn.rerender(
      <FileBrowser
        files={files}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        wanted={{ path: "src/domain/checks.test.ts" }}
      />
    )

    expect(row().getByRole("button", { name: "Hide the test files" })).toBeDefined()
    expect(screen.getByLabelText("Open file").textContent).toContain("checks.test.ts")
  })

  test("does not offer to hide them where they are the whole pull request", () => {
    const row = band([sized("src/domain/checks.test.ts", 300, 5)])

    expect(row.queryByText(/tests/)).toBeNull()
    expect(row.queryByRole("button", { name: /the test files/ })).toBeNull()
  })

  /* Stored, and nothing but tests to draw: the rail keeps them rather than
     emptying itself, and the counts say so as a line of text. */
  test("keeps a pull request that is all tests, whatever was stored", () => {
    const row = band(
      [sized("src/domain/checks.test.ts", 300, 5)],
      treeChoices({ ...DEFAULTS.tree, tests: "aside" })
    )

    expect(row.getByText(/1 changed/)).toBeDefined()
  })
})

describe("next and previous walk the rail", () => {
  // GitHub's own order for these five, which is not the order the rail draws
  // them in: the rail puts the folders above the loose files.
  const sent = [
    ".github/config.yml",
    "README.md",
    "package.json",
    "src/usage.test.ts",
    "src/usage.ts"
  ]

  const drawn = [
    ".github/config.yml",
    "src/usage.test.ts",
    "src/usage.ts",
    "package.json",
    "README.md"
  ]

  /** The path of the file on screen, off the heading above it. */
  const open = (): string => {
    const named = screen.getByLabelText("Open file").querySelector("[title]")
    return named?.getAttribute("title") ?? ""
  }

  const browser = () =>
    render(
      <FileBrowser
        files={sent.map(file)}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
      />
    )

  test("the file already open is the top row of the rail", () => {
    browser()

    expect(open()).toBe(drawn[0]!)
  })

  test("Next goes down the rail, in the order the rows are drawn", async () => {
    browser()

    const visited = [open()]
    for (let press = 0; press < sent.length; press += 1) {
      await userEvent.keyboard("j")
      visited.push(open())
    }

    const from = drawn.indexOf(visited[0]!)
    expect(visited).toEqual([...drawn.slice(from), ...drawn.slice(0, from + 1)])
  })

  test("Previous goes back up the same rail", async () => {
    browser()

    const first = open()
    await userEvent.keyboard("j")
    await userEvent.keyboard("k")

    expect(open()).toBe(first)
  })

  // The neighbours arrive one quiet moment at a time — see FileBrowser's
  // staged draw — so this waits for the set to settle rather than counting
  // renders on the way there.
  test("the two files a key reaches are drawn behind the open one, and no more", async () => {
    browser()

    await waitFor(
      () => {
        const panes = [...document.querySelectorAll("[data-file]")]
        expect(panes.map((pane) => pane.getAttribute("data-file")).sort()).toEqual(
          [drawn[0]!, drawn[1]!, drawn[4]!].sort()
        )
      },
      { timeout: 3000 }
    )

    const visible = [...document.querySelectorAll('[data-file][aria-hidden="false"]')]
    expect(visible.map((pane) => pane.getAttribute("data-file"))).toEqual([drawn[0]!])
  })
})

describe("the progress count as the way to the next unread file", () => {
  const open = (): string => {
    const named = screen.getByLabelText("Open file").querySelector("[title]")
    return named?.getAttribute("title") ?? ""
  }

  const browser = (over: ReadonlyArray<ChangedFile>) =>
    render(
      <FileBrowser
        files={over}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
      />
    )

  test("goes to the first file the reader has not been to", async () => {
    // Rail order puts the two under src/ first, and the first of those is open
    // and therefore read. So the first waiting file is the second one.
    browser([file("src/one.ts"), file("src/two.ts"), file("README.md")])

    await userEvent.click(screen.getByRole("button", { name: /of 3 seen/ }))

    expect(open()).toBe("src/two.ts")
  })

  test("skips the files GitHub already had ticked", async () => {
    browser([file("src/one.ts"), { ...file("src/two.ts"), readByViewer: true }, file("README.md")])

    await userEvent.click(screen.getByRole("button", { name: /of 3 seen/ }))

    expect(open()).toBe("README.md")
  })

  test("is a plain reading of the number once there is nowhere left to go", () => {
    browser([file("src/one.ts")])

    expect(screen.queryByRole("button", { name: /of 1 seen/ })).toBeNull()
    expect(screen.getByText(/1 of 1 seen/)).toBeDefined()
  })
})

describe("taking a mark off a file", () => {
  const sent = ["src/one.ts", "src/two.ts", "README.md"]

  const browser = (over: ReadonlyArray<ChangedFile> = sent.map(file)) =>
    render(
      <FileBrowser
        files={over}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
      />
    )

  const counted = (): string => screen.getByText(/of 3 seen/).textContent ?? ""

  test("the open file says it has been seen, because opening it is what counts", () => {
    browser()

    expect(screen.getByRole("button", { name: /^Seen/ }).getAttribute("aria-pressed")).toBe("true")
    expect(counted()).toContain("1 of 3")
  })

  test("x puts the open file back, and x again takes it forward", async () => {
    browser()

    await userEvent.keyboard("x")
    expect(screen.getByRole("button", { name: /^Not seen/ })).toBeDefined()
    expect(counted()).toContain("0 of 3")

    await userEvent.keyboard("x")
    expect(screen.getByRole("button", { name: /^Seen/ })).toBeDefined()
    expect(counted()).toContain("1 of 3")
  })

  test("a file GitHub had ticked can be put back too", async () => {
    // The half that could not be undone before: their checkbox survives the tab
    // closing, which is what makes it worth having and what made a second review
    // a hundred clicks.
    // The tick is on the second file, so it is not the one already counted for
    // being open.
    browser([file("src/one.ts"), { ...file("src/two.ts"), readByViewer: true }, file("README.md")])

    expect(counted()).toContain("2 of 3")

    // Onto the ticked file, then put it back.
    await userEvent.keyboard("j")
    expect(counted()).toContain("2 of 3")

    await userEvent.keyboard("x")
    expect(counted()).toContain("1 of 3")
  })

  test("Put all back clears every mark at once", async () => {
    browser([
      { ...file("src/one.ts"), readByViewer: true },
      { ...file("src/two.ts"), readByViewer: true },
      file("README.md")
    ])

    expect(counted()).toContain("2 of 3")

    await userEvent.click(screen.getByRole("button", { name: "Put all back" }))
    expect(counted()).toContain("0 of 3")
    // Nothing left to put back, so the button goes rather than sitting there
    // doing nothing.
    expect(screen.queryByRole("button", { name: "Put all back" })).toBeNull()
  })

  test("walking the list marks files off again after they were put all back", async () => {
    browser()

    await userEvent.click(screen.getByRole("button", { name: "Put all back" }))
    expect(counted()).toContain("0 of 3")

    await userEvent.keyboard("j")
    expect(counted()).toContain("1 of 3")
  })
})

/**
 * The knobs, at the end of the band that holds the diff they are about.
 *
 * The bar has them too, in a sheet with a preview beside it, which is where a
 * reader goes to read what each one does. This is the other errand: a diff in
 * front of you drawn one way, wanted the other way, without leaving it.
 */
describe("changing how the diff is drawn, from the band above it", () => {
  const browser = (over: Partial<FileBrowserProps> = {}) =>
    render(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        {...over}
      />
    )

  const band = (): HTMLElement => screen.getByLabelText("Files").firstElementChild as HTMLElement

  test("opens on a button at the end of the band", async () => {
    browser({ display: { settings: DEFAULTS, onChange: () => {} } })

    const way = within(band()).getByLabelText("How the files are drawn")
    // Last, and outside the cluster Next file is in: the two buttons pressed
    // dozens of times in a review keep the corner the hand already knows.
    expect(band().lastElementChild?.contains(way)).toBe(true)
    expect(within(band()).getByRole("button", { name: /Next file/ }).parentElement).not.toBe(
      way.parentElement
    )

    await userEvent.click(way)

    // Named runs of knobs rather than three loose lists: the Appearance section
    // holds a knob called Appearance, and only the grouping tells them apart.
    const menu = screen.getByRole("menu")
    for (const section of ["Appearance", "Diff", "Files"]) {
      expect(within(menu).getByRole("group", { name: section })).toBeDefined()
    }
  })

  test("reports the choice that was picked, against the settings it was given", async () => {
    let written: Settings | undefined
    browser({
      display: {
        settings: DEFAULTS,
        onChange: (settings) => {
          written = settings
        }
      }
    })

    await userEvent.click(within(band()).getByLabelText("How the files are drawn"))
    // Each knob is its own submenu, opened by the pointer landing on the row.
    await userEvent.hover(screen.getByRole("menuitem", { name: /Layout/ }))
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Side by side" }))

    expect(written?.diff.layout).toBe("split")
    // The rest of the settings ride along untouched, since this writes them whole.
    expect(written?.tree).toEqual(DEFAULTS.tree)
  })

  test("reaches the appearance knobs too, which no other button on this screen does", async () => {
    let written: Settings | undefined
    browser({
      display: {
        settings: DEFAULTS,
        onChange: (settings) => {
          written = settings
        }
      }
    })

    await userEvent.click(within(band()).getByLabelText("How the files are drawn"))
    await userEvent.hover(screen.getByRole("menuitem", { name: /^Appearance/ }))
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }))

    expect(written?.theme.appearance).toBe("dark")
  })

  test("draws no button where nobody handed it a way to change anything", () => {
    browser()

    expect(within(band()).queryByLabelText("How the files are drawn")).toBeNull()
  })
})

/**
 * Full-screen reading, off one letter.
 *
 * It is the mode a long review is read in, and reaching it meant finding a
 * button in a band that gives its labels up as the card narrows. Escape already
 * left; this is the way in, and the way back out of the same letter.
 */
describe("review mode, off the keyboard", () => {
  const band = (): HTMLElement => screen.getByLabelText("Files").firstElementChild as HTMLElement

  const browser = (active: boolean, onChange: (on: boolean) => void) =>
    render(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
        review={{ active, subject: "pr-1", head: "abc123", onChange }}
      />
    )

  test("goes in on its letter", async () => {
    const asked: Array<boolean> = []
    browser(false, (on) => asked.push(on))

    await userEvent.keyboard("r")

    expect(asked).toEqual([true])
  })

  test("comes back out on the same letter, Escape not being the only way", async () => {
    const asked: Array<boolean> = []
    browser(true, (on) => asked.push(on))

    await userEvent.keyboard("r")

    expect(asked).toEqual([false])
  })

  test("wears the letter that works, so nobody has to be told about it", () => {
    browser(false, () => {})

    const way = within(band()).getByRole("button", { name: "Review mode" })
    expect(way.getAttribute("aria-keyshortcuts")).toBe("r")
    expect(way.textContent).toContain("r")
  })
})

describe("the band says the least that is still true", () => {
  test("names the next file button Next, and still calls it Next file to a listener", () => {
    render(
      <FileBrowser
        files={[file("src/one.ts"), file("src/two.ts")]}
        fetchDiffs={() => Effect.succeed([])}
        diff={diffChoices(DEFAULTS.diff)}
        tree={treeChoices(DEFAULTS.tree)}
      />
    )

    // "file" said nothing "Next" does not, in a band where the width it spends
    // is the width that pushed the last control off the end.
    const next = screen.getByRole("button", { name: "Next file" })
    expect(next.textContent).toContain("Next")
    expect(next.textContent).not.toContain("file")
  })
})
