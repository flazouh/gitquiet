import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
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
