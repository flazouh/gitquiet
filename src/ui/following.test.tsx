import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Ledger, Where, Writing } from "../ports/Ledger"
import type { DiffHandle, DiffRequest, Modifiers, Name } from "../ports/Renderer"
import type { Across } from "./following"
import { LedgerProvider } from "./ledger"
import { RendererProvider, type LoadEngine } from "./renderer"
import { SettingsProvider } from "./settings"
import type { Store } from "../ports/Settings"
import { WholeFile } from "./WholeFile"
import { DEFAULTS } from "../domain/Settings"

/**
 * Holding a key over a name, and pressing it.
 *
 * The renderer and the Ledger are both stood in for, because neither is what
 * these are about: what is being tested is that nothing is asked until the key
 * is held, that the underline goes on the name the pointer is on and comes off
 * when it leaves, and that a press goes to the line the Ledger named.
 */

afterEach(cleanup)

const held = (over: Partial<Modifiers> = {}): Modifiers => ({
  go: false,
  shift: false,
  alt: false,
  ...over
})

/** A use of the name: line 7, where the Writing below is on line 2. */
const name: Name = { line: 7, from: 6, to: 11, text: "shape" }

/**
 * The Writing itself, as the renderer would report pressing it.
 *
 * One less than the Writing's own column, because a renderer counts a token's
 * start from nothing and a Writing's column is written for a reader.
 */
const itself: Name = { line: 2, from: 6, to: 11, text: "shape" }

const writing: Writing = {
  name: "shape",
  kind: "function",
  line: 2,
  from: 7,
  to: 12,
  signature: "const shape = () => 1",
  doc: null,
  sure: true
}

/** What the pane handed the renderer, and what the renderer was told afterwards. */
type Stage = {
  readonly asked: Array<{ row: number; column: number }>
  readonly marked: Array<readonly [Name | null, string | undefined]>
  /** How many times the outline was asked for, which should be never until it is. */
  outlined: number
  /** Every set of rows the pane has hung under the code, newest last. */
  readonly shown: Array<ReadonlyArray<{ key: string; line: number }>>
  request: DiffRequest | undefined
}

const staged = (
  found: Writing | null = writing,
  outline: ReadonlyArray<Writing> = [],
  /** For the cross-file cases: what the first question answers, and the second. */
  over: {
    readonly where?: Where
    readonly named?: Writing
    readonly across?: Across
  } = {}
) => {
  const stage: Stage = { asked: [], marked: [], outlined: 0, shown: [], request: undefined }

  const handle: DiffHandle = {
    onThemeChange: () => {},
    showNotes: (notes) => {
      stage.shown.push(notes.map((note) => ({ key: note.key, line: note.line })))
    },
    unpick: () => {},
    mark: (given, how) => {
      stage.marked.push([given, how])
    },
    boundsOf: () => ({ top: 100, left: 40, bottom: 116, right: 90 }),
    destroy: () => {}
  }

  const renderer: LoadEngine = Effect.succeed({
    renderDiff: (_container: HTMLElement, request: DiffRequest) => {
      stage.request = request
      return handle
    }
  })

  /*
   * Answers on a later tick, as the real one does.
   *
   * A Ledger that answered synchronously would be a Ledger that cannot be
   * beaten by a pointer, and the case worth testing here is exactly the one
   * where it is: the answer arrives about a name the reader has already left.
   */
  const ledger: Ledger = {
    writingAt: (_reading, at) =>
      Effect.sync(() => stage.asked.push(at)).pipe(
        Effect.flatMap(() =>
          Effect.promise(
            () =>
              new Promise<Option.Option<Where>>((go) =>
                setTimeout(() => {
                  if (over.where !== undefined) return go(Option.some(over.where))
                  go(found === null ? Option.none() : Option.some({ at: "here", writing: found }))
                }, 0)
              )
          )
        )
      ),
    writingNamed: () =>
      Effect.succeed(over.named === undefined ? Option.none() : Option.some(over.named)),
    writingsIn: () =>
      Effect.sync(() => {
        stage.outlined += 1
        return outline
      }),
    usesIn: () =>
      Effect.succeed([
        { line: 2, from: 7, to: 12 },
        { line: 4, from: 1, to: 6 }
      ]),
    usesAcross: () =>
      Effect.succeed({
        ready: true,
        uses: [
          // The file being read answers for itself, exactly, a few lines up in
          // the panel. This one must not be listed twice.
          { path: "src/one.ts", line: 2, from: 7, to: 12, sure: true },
          { path: "src/other.ts", line: 14, from: 3, to: 8, sure: true },
          { path: "src/guessed.ts", line: 3, from: 1, to: 6, sure: false }
        ]
      }),
    warm: () => Effect.succeed({ ready: true, read: 0, skipped: 0 }),
    namesLike: () => Effect.succeed({ places: [], ready: true })
  }

  const settings: Store = {
    read: Effect.succeed(DEFAULTS),
    write: () => Effect.void,
    watch: () => () => {}
  }

  render(
    <SettingsProvider store={settings}>
      <RendererProvider load={renderer}>
        <LedgerProvider ledger={ledger}>
          <WholeFile
            path="src/one.ts"
            // The declaration is on line 2, which is where `writing` says it is:
            // a Peek slices the file by that number, so the two have to agree or
            // the test is asserting about the wrong lines.
            lines={["// the file this pane is reading", "const shape = () => 1", "", "shape()"]}
            across={over.across}
          />
        </LedgerProvider>
      </RendererProvider>
    </SettingsProvider>
  )

  return stage
}

/**
 * The renderer's callbacks arrive one render after the mount, and the Ledger's
 * answer a tick after it is asked. Two turns covers both.
 */
const settled = (): Effect.Effect<void> =>
  Effect.promise(() => new Promise<void>((go) => setTimeout(() => setTimeout(go, 0), 0)))

describe("holding a key over a name", () => {
  test("asks nothing of the Ledger while the key is not held", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held())

    expect(stage.asked).toEqual([])
    expect(stage.marked).toEqual([])
  })

  test("asks where the name is written, in the renderer's own coordinates", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // One-based on the way in, zero-based on the way out: the Ledger and the
    // renderer both count from nothing, and only a reader counts from one.
    expect(stage.asked).toEqual([{ row: 6, column: 6 }])
    expect(stage.marked.map(([one]) => one)).toEqual([name])
  })

  test("marks nothing where the name has no Writing, which is most names", async () => {
    const stage = staged(null)
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(stage.asked).toHaveLength(1)
    expect(stage.marked).toEqual([])
  })

  test("takes the underline off when the pointer leaves", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onNameLeave?.(name)

    expect(stage.marked.map(([one]) => one)).toEqual([name, null])
  })

  test("does not mark a name the pointer has already left", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    stage.request?.onNameLeave?.(name)
    await Effect.runPromise(settled())

    // The answer came back about a name nobody is on any more. An underline
    // drawn now would belong to nothing.
    expect(stage.marked.map(([one]) => one)).toEqual([null])
  })

  test("presses without the key do nothing at all", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onName?.(name, held())

    expect(stage.asked).toEqual([])
  })
})

describe("reaching for the key with the pointer already on a name", () => {
  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  }
  const release = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }))
  }

  test("underlines when the key goes down, which is how a reader does it", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held())
    press("Meta")
    await Effect.runPromise(settled())

    expect(stage.marked.map(([one]) => one)).toEqual([name])
  })

  test("answers Control as well, for the readers who are not on a Mac", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held())
    press("Control")
    await Effect.runPromise(settled())

    expect(stage.marked.map(([one]) => one)).toEqual([name])
  })

  test("lets go when the key comes up, without asking anything again", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held())
    press("Meta")
    await Effect.runPromise(settled())
    release("Meta")

    expect(stage.marked.map(([one]) => one)).toEqual([name, null])
    expect(stage.asked).toHaveLength(1)
  })

  test("asks nothing where the pointer is on no name at all", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    press("Meta")
    await Effect.runPromise(settled())

    expect(stage.asked).toEqual([])
  })

  test("does not ask twice for a name it has already been told about", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    release("Meta")
    press("Meta")
    await Effect.runPromise(settled())

    expect(stage.asked).toHaveLength(1)
    expect(stage.marked.map(([one]) => one)).toEqual([name, null, name])
  })
})

describe("the card beside the name", () => {
  test("says the line, the comment above it and how sure the answer is", async () => {
    const stage = staged({
      ...writing,
      doc: "What the outer one is for."
    })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(screen.getByText("const shape = () => 1")).toBeTruthy()
    expect(screen.getByText("What the outer one is for.")).toBeTruthy()
    expect(screen.getByText("line 2")).toBeTruthy()
    expect(screen.getByText("Sure")).toBeTruthy()
  })

  test("marks a Likely answer as one, where a reader can see it", async () => {
    const stage = staged({ ...writing, sure: false as unknown as true })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(screen.getByText("Likely")).toBeTruthy()
  })

  test("is not there when the key is not held", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held())
    await Effect.runPromise(settled())

    expect(screen.queryByText("const shape = () => 1")).toBeNull()
  })

  test("goes when the pointer leaves, and when the key comes up", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    expect(screen.getByText("const shape = () => 1")).toBeTruthy()

    stage.request?.onNameLeave?.(name)
    await Effect.runPromise(settled())
    expect(screen.queryByText("const shape = () => 1")).toBeNull()
  })

  test("goes when the name is pressed, because the panel has the screen now", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // `line 2` is the card's own way of saying where the Writing is. The panel
    // that replaced it says the same thing differently, so this is the card.
    expect(screen.queryByText("line 2")).toBeNull()
  })
})

describe("the names in this file", () => {
  const outline: ReadonlyArray<Writing> = [
    { ...writing, name: "shape", kind: "function", line: 2 },
    { ...writing, name: "said", kind: "function", line: 14 },
    { ...writing, name: "Held", kind: "type", line: 20 }
  ]

  test("opens on its key and lists what the file writes down", async () => {
    staged(writing, outline)
    await Effect.runPromise(settled())

    await userEvent.keyboard("o")

    expect(await screen.findByRole("textbox", { name: "Names in this file" })).toBeTruthy()
    expect(screen.getByText("shape")).toBeTruthy()
    expect(screen.getByText("Held")).toBeTruthy()
  })

  test("says what kind each one is, and where", async () => {
    staged(writing, outline)
    await Effect.runPromise(settled())

    await userEvent.keyboard("o")
    await screen.findByRole("textbox", { name: "Names in this file" })

    expect(screen.getAllByText("fn")).toHaveLength(2)
    expect(screen.getByText("type")).toBeTruthy()
    expect(screen.getByText("14")).toBeTruthy()
  })

  test("narrows to what is typed, by the rules a path is ranked by", async () => {
    staged(writing, outline)
    await Effect.runPromise(settled())

    await userEvent.keyboard("o")
    await screen.findByRole("textbox", { name: "Names in this file" })
    await userEvent.keyboard("hld")

    expect(screen.getByText("Held")).toBeTruthy()
    expect(screen.queryByText("said")).toBeNull()
  })

  test("asks for the outline only when it is asked for", async () => {
    const stage = staged(writing, outline)
    await Effect.runPromise(settled())

    expect(stage.outlined).toBe(0)

    await userEvent.keyboard("o")
    await screen.findByRole("textbox", { name: "Names in this file" })

    expect(stage.outlined).toBe(1)
  })
})

describe("a name this file borrowed from another", () => {
  const borrowed: Where = {
    at: "elsewhere",
    borrowed: { name: "two", specifier: "./whole" }
  }

  const elsewhere: Writing = {
    name: "two",
    kind: "function",
    line: 2,
    from: 14,
    to: 17,
    signature: "export const two = (given: number): number => given * 2",
    doc: "What the other file borrows, and what it is for.",
    sure: true
  }

  const crossing = (over: Partial<Across> = {}) => {
    const opened: Array<{ path: string; line: number }> = []
    const read: Array<string> = []

    const across: Across = {
      paths: new Set(["src/one.ts", "src/whole.ts"]),
      read: (path) =>
        Effect.sync(() => {
          read.push(path)
          return "export const two = () => 2"
        }),
      open: (path, line) => opened.push({ path, line }),
      ...over
    }

    const stage = staged(null, [], { where: borrowed, named: elsewhere, across })
    return { stage, opened, read }
  }

  test("reads the file it was borrowed from, and says which one that is", async () => {
    const { stage, read } = crossing()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(read).toEqual(["src/whole.ts"])
    expect(screen.getByText("src/whole.ts:2")).toBeTruthy()
    expect(screen.getByText(elsewhere.doc!)).toBeTruthy()
  })

  test("opens that file at that line when it is pressed", async () => {
    const { stage, opened } = crossing()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // A borrowed name is never the Writing — the Writing is in the other file,
    // and that is where the press goes.
    expect(opened).toEqual([{ path: "src/whole.ts", line: 2 }])
  })

  test("asks who depends on it from the keyboard, where there is nowhere to go", async () => {
    const { stage } = crossing()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    // `u` is the same question for a hand already on the keyboard, and it is
    // the only way to ask it about a name written somewhere else.
    expect(await screen.findByText("written in src/whole.ts")).toBeTruthy()
  })

  test("does nothing where the repository has no such file", async () => {
    const { stage, opened, read } = crossing({ paths: new Set(["src/one.ts"]) })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true }))

    // Nothing fetched on a guess, and no underline under a name that leads
    // nowhere.
    expect(read).toEqual([])
    expect(opened).toEqual([])
    expect(stage.marked).toEqual([])
  })

  test("does nothing at all where the pane cannot reach other files", async () => {
    const stage = staged(null, [], { where: borrowed, named: elsewhere })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(stage.marked).toEqual([])
  })
})

describe("peeking, which is the question asked without leaving", () => {
  test("hangs the Writing's own lines under the line that asked", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true, shift: true }))
    await Effect.runPromise(settled())

    const [rows] = stage.shown.slice(-1)
    expect(rows?.map((note) => note.line)).toEqual([name.line])

    // The row is filled by the pane, from the file it is reading.
    const filled = stage.request?.fillNote?.("gitquiet/peek")
    expect(filled?.textContent).toContain("const shape = () => 1")
    expect(filled?.textContent).toContain("line 2")
  })

  test("does not take the reader anywhere, which is the whole point of it", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true, shift: true }))
    await Effect.runPromise(settled())

    // The card goes — the reader is looking at the rows now, not at it.
    expect(screen.queryByText("const shape = () => 1")).toBeNull()
  })

  test("goes away on Escape, which is what Escape means everywhere here", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true, shift: true }))
    await Effect.runPromise(settled())
    expect(stage.shown.at(-1)).toHaveLength(1)

    await userEvent.keyboard("{Escape}")
    await Effect.runPromise(settled())

    expect(stage.shown.at(-1)).toEqual([])
  })
})

describe("everywhere in this file that means the same name", () => {
  test("opens on its key, about the name the pointer is on", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")

    // By what it says rather than by its role: `showModal` in happy-dom does not
    // put a dialog into the accessibility tree the way a browser does, which is
    // why every other dialog in these tests is found by its contents too.
    expect(await screen.findByText("2 in this file")).toBeTruthy()
    // The line each Use is on, so a call can be told from a declaration without
    // going to look at it.
    expect(screen.getAllByText("const shape = () => 1").length).toBeGreaterThan(0)
  })

  test("does not open where the pointer is on no name", async () => {
    staged()
    await Effect.runPromise(settled())

    await userEvent.keyboard("u")

    expect(screen.queryByText("2 in this file")).toBeNull()
  })
})

describe("uses across the repository", () => {
  const withRepo = (): Across => ({
    paths: new Set(["src/one.ts", "src/other.ts"]),
    repo: { owner: "flowline-labs", repo: "flowline" },
    sha: "abc123",
    read: () => Effect.succeed(""),
    open: () => {}
  })

  test("lists the rest of the repository under this file's own", async () => {
    const stage = staged(writing, [], { across: withRepo() })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    expect(await screen.findByText("Elsewhere in the repository")).toBeTruthy()
    expect(screen.getByText("src/other.ts")).toBeTruthy()
  })

  test("says which of them is Sure and which is only Likely", async () => {
    const stage = staged(writing, [], { across: withRepo() })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    // A reader deciding whether a rename is safe needs to know which is which.
    expect(screen.getByText("Likely")).toBeTruthy()
    expect(screen.getAllByText("Sure").length).toBeGreaterThan(0)
  })

  test("does not list this file twice, once exactly and once by a rule", async () => {
    const stage = staged(writing, [], { across: withRepo() })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    expect(screen.queryByText("src/one.ts")).toBeNull()
  })

  test("asks nothing of a repository where the screen does not know one", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    expect(screen.queryByText("Elsewhere in the repository")).toBeNull()
  })
})

describe("what a press on an underlined name does", () => {
  test("opens the list rather than taking the reader anywhere", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // On the Writing itself, where there is nowhere to be taken.
    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // Reading somebody's pull request, the question is nearly always "what is
    // this and who depends on it" rather than "take me there" — and being moved
    // mid-review is the thing this interface exists to stop happening.
    expect(await screen.findByText("2 in this file")).toBeTruthy()
    // Twice: the row saying where it is written, and the mark on the Use that
    // is the writing itself.
    expect(screen.getAllByText("written")).toHaveLength(2)
  })

  test("offers where it is written as the first row, so a use of it is one more press", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // Twice over, which is right: the row saying where it is written, and the
    // line of the Use that is the writing itself.
    expect(screen.getAllByText(writing.signature).length).toBeGreaterThan(1)
  })

  test("still peeks on Shift, whichever end the press is on", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true, shift: true }))
    await Effect.runPromise(settled())

    expect(screen.queryByText("2 in this file")).toBeNull()
    expect(stage.shown.at(-1)).toHaveLength(1)
  })
})

describe("which of the two a press is", () => {
  test("a press on a use asks to be taken to it, and opens no panel", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(screen.queryByText("2 in this file")).toBeNull()
  })

  test("a press on the Writing itself asks who depends on it", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // There is nowhere to be taken: the reader is already looking at it.
    expect(await screen.findByText("2 in this file")).toBeTruthy()
  })

  test("counts the two sides' columns as the two sides count them", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // One column off the Writing is a different word to a reader, and must not
    // be taken for the Writing. Without the adjustment between a renderer's
    // count and a Writing's, no press is ever on a Writing and this feature has
    // half of itself quietly missing.
    const beside: Name = { ...itself, from: itself.from + 1 }
    stage.request?.onNameEnter?.(beside, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(beside, held({ go: true }))
    await Effect.runPromise(settled())

    expect(screen.queryByText("2 in this file")).toBeNull()
  })

})

describe("which reading answered, where the reader can see it", () => {
  test("underlines solid and says so where a compiler answered", async () => {
    const stage = staged({ ...writing, exact: true })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(stage.marked.at(-1)).toEqual([name, "sure"])
    expect(screen.getByText("Types")).toBeTruthy()
  })

  test("underlines dotted where a reading of shapes answered", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // The same underline the reader was getting either way, drawn differently:
    // nothing is added to the screen and the difference is visible anyway.
    expect(stage.marked.at(-1)).toEqual([name, "likely"])
    expect(screen.getByText("Sure")).toBeTruthy()
  })
})
