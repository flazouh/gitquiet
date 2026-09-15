import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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

/**
 * What the stage put on the page, taken off again.
 *
 * The rows a pane hands back through `fillNote` are appended here the way the
 * renderer appends them, and `cleanup` does not know about them — it removes
 * what `render` mounted and nothing else. Left behind, they outlive the file:
 * every test process shares one document, and a preview of some code sitting in
 * `document.body` for the rest of the run is a `getByText` somewhere else
 * finding two matches and throwing. Which is what happened, to a markdown test
 * about a coloured fence, on continuous integration only, because the order
 * differs there.
 */
const left: Array<HTMLElement> = []

afterEach(() => {
  cleanup()
  for (const node of left.splice(0)) node.remove()
})

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
  /** How many times the pane said it was ready to be asked, before any key. */
  readied: number
  /** Every set of rows the pane has hung under the code, newest last. */
  readonly shown: Array<ReadonlyArray<{ key: string; line: number }>>
  request: DiffRequest | undefined
  /**
   * Every request the renderer was handed, in order.
   *
   * The file is one; the preview beside the uses is another, drawn by the same
   * renderer because there is no second renderer for code here. `request` stays
   * the file's, so the tests reaching for the token handlers keep reaching for
   * the ones the file reported.
   */
  readonly drew: Array<DiffRequest>
  /** The element each of those was drawn into, in the same order. */
  readonly into: Array<HTMLElement>
}

const staged = (
  found: Writing | null = writing,
  outline: ReadonlyArray<Writing> = [],
  /** For the cross-file cases: what the first question answers, and the second. */
  over: {
    readonly where?: Where
    readonly named?: Writing
    readonly across?: Across
    /**
     * A different Writing from the second question onward.
     *
     * For the trail: a panel refuses a step onto the name it is already showing
     * — pressing it would add a row saying the reader is where they are — so a
     * stage that answers with one Writing for ever cannot walk anywhere.
     */
    readonly then?: Writing
    /** What another repository answers, for a name borrowed from a package. */
    readonly beyond?: {
      readonly owner?: string
      readonly repo?: string
      readonly ref?: string
      readonly path?: string
      readonly line?: number
      readonly name?: string
      readonly signature?: string
      readonly here?: boolean
      readonly why?: string
    }
  } = {}
) => {
  const stage: Stage = {
    asked: [],
    marked: [],
    outlined: 0,
    readied: 0,
    shown: [],
    request: undefined,
    /**
     * Every request the renderer was handed, in order.
     *
     * The file is one. The preview beside the uses is another — it is drawn by
     * the same renderer, because there is no second renderer for code here and
     * there should not be one. `request` stays the file's, so the tests that
     * reach for the token handlers keep reaching for the ones the file
     * reported.
     */
    drew: [] as Array<DiffRequest>,
    into: [] as Array<HTMLElement>
  }

  const handle: DiffHandle = {
    onThemeChange: () => {},
    showNotes: (notes) => {
      stage.shown.push(notes.map((note) => ({ key: note.key, line: note.line })))
      /*
       * And put them on the screen, which is what the renderer does with them.
       *
       * A row is a key here and an element the pane hands back through
       * `fillNote`; the real renderer asks for that element and inserts it
       * under the line. A stub that only remembered the keys left every row
       * the pane drew in a node attached to nothing, so a test could see a
       * Peek's key and never its words — and when the Uses moved into a row of
       * their own, eleven tests went looking for a panel that was, correctly,
       * not in the document.
       */
      for (const note of notes) {
        const filled = stage.request?.fillNote?.(note.key)
        if (filled !== undefined && filled !== null && !filled.isConnected) {
          document.body.append(filled)
          left.push(filled)
        }
      }
    },
    unpick: () => {},
    mark: (given, how) => {
      stage.marked.push([given, how])
    },
    boundsOf: () => ({ top: 100, left: 40, bottom: 116, right: 90 }),
    destroy: () => {}
  }

  const renderer: LoadEngine = Effect.succeed({
    renderDiff: (container: HTMLElement, request: DiffRequest) => {
      stage.drew.push(request)
      stage.into.push(container)
      stage.request ??= request
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
    ready: () =>
      Effect.sync(() => {
        stage.readied += 1
      }),
    writingAt: (_reading, at) =>
      Effect.sync(() => stage.asked.push(at)).pipe(
        Effect.flatMap(() =>
          Effect.promise(
            () =>
              new Promise<Option.Option<Where>>((go) =>
                setTimeout(() => {
                  if (over.where !== undefined) return go(Option.some(over.where))
                  const answer =
                    over.then !== undefined && stage.asked.length > 1 ? over.then : found
                  go(answer === null ? Option.none() : Option.some({ at: "here", writing: answer }))
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
    beyond: () => Effect.succeed(over.beyond ?? { why: "nothing there" }),
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

    /*
     * Waited for rather than read once.
     *
     * A Peek is an answer from the Ledger and arrives an effect later, so the
     * newest set of rows a moment after the press may still be the set from
     * before it. Green here and red on a loaded continuous-integration runner,
     * which is a test passing because the computer was fast enough.
     */
    await waitFor(() => {
      const [rows] = stage.shown.slice(-1)
      expect(rows?.some((note) => note.line === name.line)).toBe(true)
    })

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
    // Once. `usesIn` answers with every occurrence and the declaration is one
    // of them, so the card used to draw it twice — its own row at the top and
    // again in the list below, the same line under a heading that could say
    // "used nowhere else in this file". Filmed on a live commit, which is the
    // only place it looked as wrong as it was.
    expect(screen.getAllByText("written")).toHaveLength(1)
  })

  test("offers where it is written as the first row, so a use of it is one more press", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // One row, and at the top: where the name is written. The Use that *is* the
    // writing is not listed again below it — a list offering the same line
    // twice reads as two answers to one question.
    //
    // Counted among the rows rather than among everything on the screen: the
    // preview beside the list shows the code around whichever row is showing,
    // and the first row is the writing, so its line is on the screen twice on
    // purpose. Once as the row, once as the code the row is pointing at.
    //
    // `waitFor` all the same: the Uses arrive an effect later and decide
    // whether anything is filtered out.
    await waitFor(() => {
      const listed = screen
        .getAllByRole("button")
        .filter((row) => (row.textContent ?? "").includes(writing.signature))
      expect(listed).toHaveLength(1)
    })
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

describe("a name borrowed from a package rather than a path", () => {
  const fromPackage: Where = {
    at: "elsewhere",
    borrowed: { name: "one", specifier: "@yourorg/thing" }
  }

  const staging = (beyond: Record<string, unknown>) =>
    staged(null, [], {
      where: fromPackage,
      beyond,
      across: {
        paths: new Set(["src/one.ts"]),
        repo: { owner: "flowline-labs", repo: "flowline" },
        sha: "abc123",
        read: () => Effect.succeed(""),
        open: () => {}
      }
    })

  test("says which repository it is in, and offers the way there", async () => {
    const stage = staging({
      owner: "yourorg",
      repo: "thing",
      ref: "HEAD",
      path: "src/one.ts",
      line: 4,
      name: "one",
      signature: "export const one = () => 1"
    })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // Leaving a repository is a larger thing than scrolling, so it is a press
    // rather than a consequence of one — and it says where it is going first.
    expect(await screen.findByText("yourorg/thing · src/one.ts:4")).toBeTruthy()
    expect(screen.getByText("export const one = () => 1")).toBeTruthy()
    expect(screen.getByText("Likely")).toBeTruthy()
  })

  test("says only the path where the package turned out to be this repository's own", async () => {
    const stage = staging({
      here: true,
      owner: "flowline-labs",
      repo: "flowline",
      path: "packages/thing/index.ts",
      line: 9,
      name: "one",
      signature: "export const one = () => 1"
    })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // A monorepo's own package is not another repository, and saying so would
    // be telling a reader they are leaving when they are not.
    expect(await screen.findByText("packages/thing/index.ts:9")).toBeTruthy()
  })

  test("draws nothing where no repository answers to the package", async () => {
    const stage = staging({ why: "no repository answers to that package" })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    expect(screen.queryByText(/Likely/)).toBeNull()
    expect(stage.marked).toEqual([])
  })
})

describe("the waiting a reader used to do", () => {
  test("opens the door when the file draws, not when the key goes down", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // Nothing has been asked and no key has been held. What has happened is a
    // worker waking, a document opening and a grammar arriving — which is what
    // the reader was watching a word not underline through.
    expect(stage.readied).toBeGreaterThan(0)
    expect(stage.asked).toEqual([])
  })
})

describe("a name from another repository, seen before it is pressed", () => {
  test("underlines like every other answer does", async () => {
    const stage = staged(null, [], {
      where: { at: "elsewhere", borrowed: { name: "one", specifier: "@yourorg/thing" } },
      beyond: { owner: "yourorg", repo: "thing", path: "src/one.ts", line: 4, name: "one" },
      across: {
        paths: new Set(["src/one.ts"]),
        repo: { owner: "flowline-labs", repo: "flowline" },
        sha: "abc123",
        read: () => Effect.succeed(""),
        open: () => {}
      }
    })
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    // It drew a card and left the word plain, which made a name from another
    // repository the one kind a reader could not see was followable.
    expect(stage.marked.at(-1)).toEqual([name, "likely"])
  })
})

describe("a press after the pointer has moved on", () => {
  test("still answers, because the reader pressed that name", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // The renderer reports a leave as the button goes down, so this is what
    // every press looked like: the answer came back about a name the pointer
    // was no longer on, and a guard written for hovering threw it away. The
    // press did nothing at all, and nothing said why.
    stage.request?.onNameEnter?.(itself, held({ go: true }))
    stage.request?.onNameLeave?.(itself)
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    expect(await screen.findByText("2 in this file")).toBeTruthy()
  })

  test("a hover that arrives late still draws nothing", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // The other half of the same rule, which must not be lost to fixing this:
    // an underline drawn for a name the reader has left belongs to nothing.
    stage.request?.onNameEnter?.(name, held({ go: true }))
    stage.request?.onNameLeave?.(name)
    await Effect.runPromise(settled())

    expect(stage.marked.map(([one]) => one)).toEqual([null])
  })
})

/**
 * The leave the renderer sends as the button goes down.
 *
 * `onTokenLeave` arrives before `onTokenClick` on a real pointer — the press
 * itself is what takes the pointer off the name, as far as the renderer is
 * concerned. Every test above calls enter and then press with nothing in
 * between, which is a pointer no hand has ever made, and so every one of them
 * passed while the gesture did nothing on a real screen.
 *
 * It was found and fixed once, for the press that opens the uses. The press
 * with Shift kept asking without insisting and kept having its answer thrown
 * away, and nothing here noticed for as long as the tests were polite.
 */
describe("a press that the pointer has already left", () => {
  test("still peeks on Shift", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    // The renderer, reporting the pointer gone as the button goes down.
    stage.request?.onNameLeave?.(name)
    stage.request?.onName?.(name, held({ go: true, shift: true }))
    await Effect.runPromise(settled())

    /*
     * Waited for rather than read once.
     *
     * A Peek is an answer from the Ledger and arrives an effect later, so the
     * newest set of rows a moment after the press may still be the set from
     * before it. Green here and red on a loaded continuous-integration runner,
     * which is a test passing because the computer was fast enough.
     */
    await waitFor(() => {
      const [rows] = stage.shown.slice(-1)
      expect(rows?.some((note) => note.line === name.line)).toBe(true)
    })
  })

  test("still opens the uses on a press without Shift", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onNameLeave?.(itself)
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    expect(await screen.findByText("2 in this file")).toBeTruthy()
  })
})

/**
 * The letter, pressed by a reader holding nothing.
 *
 * `u` is the uses of whatever the pointer is on, and the whole point of it is
 * that it asks without the key. It used to answer only where the Writing was
 * already in hand — which it only ever is while Command is held — so it worked
 * for a reader who did not need it and did nothing for one who did.
 */
describe("asking by the letter rather than by the key", () => {
  test("answers for a name the pointer is merely on", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    // No key: a pointer resting on a name, which is all a reader has done.
    stage.request?.onNameEnter?.(itself, held({ go: false }))
    await Effect.runPromise(settled())
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    expect(await screen.findByText("2 in this file")).toBeTruthy()
  })

  test("still says nothing where the pointer is on nothing", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameLeave?.(itself)
    await userEvent.keyboard("u")
    await Effect.runPromise(settled())

    expect(screen.queryByText("2 in this file")).toBeNull()
  })
})

/**
 * Where the panel opens.
 *
 * A reader pressed a word in the middle of a line they were reading. Answering
 * from the centre of the window makes them find the answer, read it, and then
 * find their way back to the line — three moves for one question that was asked
 * with their eye already on the word.
 */
describe("the uses answered in the file rather than over it", () => {
  test("hangs the list under the line that asked, like a Peek", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // A row, at the line pressed — not a panel at a screen coordinate. The
    // file opens apart and the answer sits in the gap, which is how an editor
    // answers this and the reason the lines around the name stay readable.
    await waitFor(() => {
      const [drawn] = stage.shown.slice(-1)
      expect(drawn?.some((note) => note.line === itself.line)).toBe(true)
    })
    expect(await screen.findByLabelText(`Uses of ${writing.name}`)).toBeTruthy()
  })

  test("shows the code behind whichever row the pointer is on", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    // Handed to the renderer as a patch of all context, numbered from the line
    // it starts on rather than from one — a preview of lines 120 to 136 that
    // counts 1 to 17 is beside code plainly not at the top of anything.
    await screen.findByLabelText(`Uses of ${writing.name}`)
    await waitFor(() => expect(stage.drew.length).toBeGreaterThan(1))

    const drawn = stage.drew.at(-1)
    expect(drawn?.patch).toContain(writing.signature)
    expect(drawn?.patch).toContain("@@ -1,")
  })
})

/**
 * The split, dragged, and remembered.
 *
 * VS Code keeps this on the widget — seven parts to three until somebody drags
 * it otherwise, and then whatever they dragged it to for the rest of the visit.
 * A reader who widens the list to read a long path does not want it narrow
 * again at the next name.
 */
describe("how wide the code is, and how tall", () => {
  test("offers a sash between the code and the list", async () => {
    const stage = staged()
    await Effect.runPromise(settled())

    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())

    const panel = await screen.findByLabelText(`Uses of ${writing.name}`)
    expect(panel.querySelector('[aria-label="How wide the code is"]')).toBeTruthy()
    expect(panel.querySelector('[aria-label="How tall this is"]')).toBeTruthy()
  })
})

/**
 * Moving through the answer without a pointer.
 *
 * The list was pointer-only: the preview followed the pointer and nothing else
 * moved it, so a reader who opened this from the keyboard — which is how `u`
 * opens it — got an answer they could look at and not move through.
 */
describe("the uses, from the keyboard", () => {
  const open = async (stage: ReturnType<typeof staged>) => {
    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    return screen.findByLabelText(`Uses of ${writing.name}`)
  }

  test("puts the focus on the first row, so the arrows have somewhere to start", async () => {
    const stage = staged()
    await Effect.runPromise(settled())
    const panel = await open(stage)

    const rows = [...panel.querySelectorAll<HTMLElement>("li button")]
    await waitFor(() => expect(document.activeElement).toBe(rows[0] ?? null))
  })

  test("moves down the rows on the arrow, and stops at the end", async () => {
    const stage = staged()
    await Effect.runPromise(settled())
    const panel = await open(stage)

    const rows = [...panel.querySelectorAll<HTMLElement>("li button")]
    expect(rows.length).toBeGreaterThan(1)

    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() => expect(document.activeElement).toBe(rows[1] ?? null))

    // Past the end is the end, not a wrap: a list that loops loses a reader
    // who was holding the key to get to the bottom of it.
    for (let press = 0; press < rows.length + 2; press++) {
      await userEvent.keyboard("{ArrowDown}")
    }
    expect(document.activeElement).toBe(rows[rows.length - 1] ?? null)

    await userEvent.keyboard("{ArrowUp}")
    expect(document.activeElement).toBe(rows[rows.length - 2] ?? null)
  })

  test("keeps one row in the tab order, so Tab leaves rather than walks", async () => {
    const stage = staged()
    await Effect.runPromise(settled())
    const panel = await open(stage)

    const rows = [...panel.querySelectorAll<HTMLElement>("li button")]
    await waitFor(() =>
      expect(rows.filter((row) => row.getAttribute("tabindex") === "0")).toHaveLength(1)
    )
  })
})

/**
 * Walking a call chain without leaving the panel.
 *
 * A Peek says what a name is. The question after it is nearly always what
 * *that* calls, and the one after that the same again — which used to mean
 * closing the panel, finding the name in the file, holding the key and pressing
 * it, three times over, with the thread of the question carried in the reader's
 * head between each.
 */
describe("the trail through a call chain", () => {
  /** A second name to walk on to, which is what the preview would resolve. */
  const further: Writing = { ...writing, name: "further", line: 40, from: 6, to: 13 }

  const open = async (stage: ReturnType<typeof staged>) => {
    stage.request?.onNameEnter?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    stage.request?.onName?.(itself, held({ go: true }))
    await Effect.runPromise(settled())
    return screen.findByLabelText(`Uses of ${writing.name}`)
  }

  test("starts at the name that was asked about, with nowhere behind it", async () => {
    const stage = staged()
    await Effect.runPromise(settled())
    const panel = await open(stage)

    // One name in the head and no way back, because there is nowhere to go.
    expect(panel.querySelector("h2")?.textContent).toBe(writing.name)
    expect(panel.querySelector("h2 button")).toBeNull()
  })

  test("takes a step when a name in the preview is followed", async () => {
    const stage = staged(writing, [], { then: further })
    await Effect.runPromise(settled())
    const panel = await open(stage)

    // The preview is a drawing of its own, and it reports its own tokens.
    await waitFor(() => expect(stage.drew.length).toBeGreaterThan(1))
    const inPreview = stage.drew.at(-1)
    inPreview?.onName?.(name, held({ go: true }))
    await Effect.runPromise(settled())

    await waitFor(() => expect(panel.querySelector("h2 button")).not.toBeNull())
    expect(panel.querySelector("h2")?.textContent).toContain("›")
  })

  test("goes back a name on Escape before it closes at all", async () => {
    const stage = staged(writing, [], { then: further })
    await Effect.runPromise(settled())
    const panel = await open(stage)

    await waitFor(() => expect(stage.drew.length).toBeGreaterThan(1))
    stage.drew.at(-1)?.onName?.(name, held({ go: true }))
    await Effect.runPromise(settled())
    await waitFor(() => expect(panel.querySelector("h2 button")).not.toBeNull())

    await userEvent.keyboard("{Escape}")
    await Effect.runPromise(settled())

    // Back to the name it started on, and still open.
    await waitFor(() => expect(panel.querySelector("h2 button")).toBeNull())
    // Still open, and back at the name it started on.
    expect(panel.querySelector("h2")?.textContent).toBe(writing.name)
  })

  /**
   * A press in the preview is the preview's, and the file's renderer never
   * hears it.
   *
   * The panel is slotted into the drawing above it, so everything that happens
   * inside it goes on up through that drawing's own element — where the file's
   * renderer is listening for presses on its lines and for a pointer to carry
   * its gutter plus to. `drawnBy` in `engine.ts` turns away the names; these
   * are the rest, which arrive as lines and have no name in them to refuse.
   */
  test("keeps a press in the preview from reaching the file behind it", async () => {
    const stage = staged(writing, [], { then: further })
    await Effect.runPromise(settled())
    const panel = await open(stage)

    await waitFor(() => expect(stage.into.length).toBeGreaterThan(1))
    const shown = stage.into.at(-1)

    const heard: Array<string> = []
    const listen = (event: Event) => heard.push(event.type)
    for (const kind of ["pointerdown", "pointermove", "click"]) {
      document.body.addEventListener(kind, listen)
    }

    // Dispatched on a child of the container, which is where the preview's own
    // drawing is: the seal sits on the container and lets what is under it
    // finish first.
    const token = document.createElement("span")
    shown?.append(token)
    token.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    token.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }))
    token.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(heard).toEqual([])

    // And the panel around it is not sealed: only the drawing is. A press on
    // the head still reaches the page, which is how everything else here works.
    panel.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(heard).toEqual(["click"])

    for (const kind of ["pointerdown", "pointermove", "click"]) {
      document.body.removeEventListener(kind, listen)
    }
  })
})
