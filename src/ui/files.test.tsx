import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect, Option } from "effect"
import { aComment, aThread, anchoredAt, person } from "../../tests/snapshots"
import { revealer } from "../app/revealing"
import type { DiffHandle, DiffRequest } from "../ports/Renderer"
import type { ChangedFile } from "../domain/PullRequest"
import { diffChoices } from "../domain/choices"
import { DEFAULTS, type Settings } from "../domain/Settings"
import type { Store } from "../ports/Settings"
import { FileDiffPane } from "./Files"
import { ROOT_ID } from "./mount"
import { RendererProvider, type LoadEngine } from "./renderer"
import { SettingsProvider } from "./settings"
import { Theme } from "./Theme"

/**
 * The renderer, stood in for.
 *
 * It is four and a half megabytes of Pierre behind an extension URL and it
 * writes into a shadow root, neither of which exists in here — so what the pane
 * asks it to draw is the only part of this that can be read in a test. That is
 * enough for the question being asked: whether the pane offers to write.
 */
const asked: Array<DiffRequest> = []

const handle: DiffHandle = {
  onThemeChange: () => {},
  showNotes: () => {},
  unpick: () => {},
  destroy: () => {}
}

const stub: LoadEngine = Effect.succeed({
  renderDiff: (_container: HTMLElement, request: DiffRequest) => {
    asked.push(request)
    return handle
  }
})

afterEach(() => {
  cleanup()
  asked.length = 0
  document.documentElement.removeAttribute("data-color-mode")
  for (const found of document.querySelectorAll(`#${ROOT_ID}`)) found.remove()
})

/** A store that answers with one set of choices and hears nothing afterwards. */
const holding = (settings: Settings): Store => ({
  read: Effect.sync(() => settings),
  write: () => Effect.void,
  watch: () => () => {}
})

const file: ChangedFile = {
  path: "src/one.ts",
  digest: "one-digest",
  changeType: "modified",
  linesAdded: 1,
  linesDeleted: 1,
  readByViewer: false,
  diff: Option.some({
    isBinary: false,
    isTruncated: false,
    lines: [
      { kind: "hunk", text: "@@ -1,2 +1,2 @@", beforeLine: Option.none(), afterLine: Option.none() },
      { kind: "context", text: " one", beforeLine: Option.some(1), afterLine: Option.some(1) },
      { kind: "added", text: "+ two", beforeLine: Option.none(), afterLine: Option.some(2) }
    ]
  })
}

/* One set for every render, the way the screens hand it down: they memoise it,
   and a fresh copy per render would be testing the harness, not the pane. */
const CHOICES = diffChoices(DEFAULTS.diff)

const pane = (props: Partial<React.ComponentProps<typeof FileDiffPane>> = {}) => (
  <RendererProvider load={stub}>
    <FileDiffPane
      file={file}
      ask={() => Effect.succeed(Option.none())}
      choices={CHOICES}
      {...props}
    />
  </RendererProvider>
)

const drawn = async (): Promise<DiffRequest> => {
  await waitFor(() => {
    expect(asked).toHaveLength(1)
  })
  return asked[0]!
}

describe("the click is answered before the file is drawn", () => {
  /*
   * The draw is a few hundred milliseconds of synchronous engine work on a fat
   * patch. Run inside the commit that mounted the pane, it held the click's own
   * answer hostage: the selection, the heading and the pointer all waited for
   * it. One painted frame goes first; the draw follows.
   */
  test("mounting a pane does not draw in the same breath", async () => {
    render(pane())

    expect(asked).toHaveLength(0)

    await drawn()
  })
})

describe("which colours a file is drawn in", () => {
  test("follows the reader's appearance, not GitHub's page", async () => {
    document.documentElement.setAttribute("data-color-mode", "light")
    const root = document.createElement("div")
    root.id = ROOT_ID
    document.body.append(root)

    render(
      <SettingsProvider
        store={holding({
          ...DEFAULTS,
          theme: { ...DEFAULTS.theme, appearance: "dark", pack: "dracula" }
        })}
      >
        <Theme element={root}>{pane()}</Theme>
      </SettingsProvider>
    )

    await waitFor(() => {
      expect(asked.at(-1)?.theme).toBe("dark")
    })
    expect(asked.at(-1)?.pack).toBe("dracula")
  })
})

describe("marking lines out to say something about them", () => {
  test("is offered where a remark can be sent", async () => {
    render(pane({ onPost: () => Effect.void }))

    expect((await drawn()).onPick).toBeDefined()
  })

  test("is not offered where there is nothing to send it to", async () => {
    // A commit read on its own page: GitHub's route for a review comment is a
    // pull request's, and this one is not on any. Left on, the gutter's plus and
    // the drag across the line numbers both open a box whose Comment button
    // cannot come up — and a draft saved from it can never be sent, which is a
    // worse offer than not making one.
    render(pane())

    expect((await drawn()).onPick).toBeUndefined()
  })

  /*
   * The way to send is a fresh closure on every render of the screen above, and
   * the drawing must not care: redrawing a diff is hundreds of milliseconds,
   * and paying it for every render of the browser around it was every mounted
   * file redrawn several times per click. Only whether a remark can be sent is
   * baked into the drawing.
   */
  test("the same file is not drawn again because the way to send was recreated", async () => {
    const { rerender } = render(pane({ onPost: () => Effect.void }))
    await drawn()

    rerender(pane({ onPost: () => Effect.void }))
    // Long enough for a redraw effect to have run if one was scheduled.
    await new Promise((settle) => setTimeout(settle, 50))

    expect(asked).toHaveLength(1)
  })
})

/*
 * A file whose only change is that one line moved two spaces to the right, which
 * is the case the setting exists for and the case a reader meets on any formatter
 * commit.
 */
const reindented: ChangedFile = {
  ...file,
  diff: Option.some({
    isBinary: false,
    isTruncated: false,
    lines: [
      { kind: "hunk", text: "@@ -1,2 +1,2 @@", beforeLine: Option.none(), afterLine: Option.none() },
      { kind: "context", text: " one", beforeLine: Option.some(1), afterLine: Option.some(1) },
      { kind: "deleted", text: "-two", beforeLine: Option.some(2), afterLine: Option.none() },
      { kind: "added", text: "+  two", beforeLine: Option.none(), afterLine: Option.some(2) }
    ]
  })
}

describe("holding back the changes that are only spacing", () => {
  test("hands the renderer the patch as GitHub sent it while the setting is off", async () => {
    render(pane({ file: reindented }))

    const request = await drawn()
    expect(request.patch).toContain("-two")
    expect(request.patch).toContain("+  two")
  })

  test("says so rather than drawing a file with no marks in it", async () => {
    render(pane({ file: reindented, choices: diffChoices({ ...DEFAULTS.diff, whitespace: "hide" }) }))

    await waitFor(() => {
      expect(screen.getByText(/Only the spacing changed/)).toBeDefined()
    })
    // Nothing was asked of the renderer, which is the point: there is no patch
    // left to draw, and an empty one renders as an empty file.
    expect(asked).toHaveLength(0)
  })

  test("still draws the file when a real change is in it too", async () => {
    const mixed: ChangedFile = {
      ...reindented,
      diff: Option.some({
        isBinary: false,
        isTruncated: false,
        lines: [
          ...Option.getOrThrow(reindented.diff).lines,
          { kind: "added", text: "+three", beforeLine: Option.none(), afterLine: Option.some(3) }
        ]
      })
    }

    render(pane({ file: mixed, choices: diffChoices({ ...DEFAULTS.diff, whitespace: "hide" }) }))

    const request = await drawn()
    expect(request.patch).toContain("+three")
    expect(request.patch).not.toContain("-two")
    expect(request.patch).toContain("   two")
  })
})

describe("a pane with no renderer behind it", () => {
  test("says so, rather than sitting on an empty box forever", async () => {
    // What a screen rendered outside a RendererProvider gets, and the same thing
    // a browser refusing the chunk gets: the pane is told there is no renderer,
    // and a reader is told too.
    render(
      <FileDiffPane
        file={file}
        ask={() => Effect.succeed(Option.none())}
        choices={diffChoices(DEFAULTS.diff)}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/could not be loaded/)).toBeDefined()
    })
    expect(asked).toHaveLength(0)
  })
})

describe("a remark on a line this file's diff does not contain", () => {
  /*
   * GitHub lets a reviewer comment on any line of a changed file from their own
   * Files changed page, expanded or not, and sends the file's hunks all the
   * same. Such a thread names a line nothing here drew, so there is no row for
   * the renderer to hang it in and the file used to read as though nobody had
   * said anything about it. See `CONTEXT.md`, Out of Reach.
   */
  const far = aThread(
    "t-far",
    [aComment(person("ana"), "this constant is stale")],
    false,
    anchoredAt("src/one.ts", 150)
  )

  test("is drawn above the file, since there is no line to hang it under", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane({ threads: [far] })}</SettingsProvider>
      </Theme>
    )

    const said = await screen.findByLabelText("Said about this file")
    expect(said.textContent).toContain("One comment is on a line GitHub left out")
    expect(said.textContent).toContain("Line 150")
    expect(said.textContent).toContain("this constant is stale")
  })

  test("is not handed to the renderer, which has no line to put it on", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane({ threads: [far] })}</SettingsProvider>
      </Theme>
    )

    expect((await drawn()).notes ?? []).toEqual([])
  })

  test("says nothing where the thread is on a line the diff does hold", async () => {
    const near = aThread(
      "t-near",
      [aComment(person("ana"), "about the new line")],
      false,
      anchoredAt("src/one.ts", 2)
    )

    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane({ threads: [near] })}</SettingsProvider>
      </Theme>
    )

    await drawn()
    expect(screen.queryByLabelText("Said about this file")).toBeNull()
  })

  test("draws a remark about the file as a whole in the same place, saying so", async () => {
    const whole = aThread(
      "t-file",
      [aComment(person("ana"), "This file should not be in this pull request.")],
      false,
      Option.some({ path: "src/one.ts" })
    )

    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane({ threads: [whole] })}</SettingsProvider>
      </Theme>
    )

    const said = await screen.findByLabelText("Said about this file")
    expect(said.textContent).toContain("About this file")
    expect(said.textContent).toContain("should not be in this pull request")
    // It never had a line, so it is not reported as one GitHub left out.
    expect(said.textContent).not.toContain("left out of this file's diff")
  })

  test("hands the renderer no row for one about the whole file", async () => {
    const whole = aThread(
      "t-file",
      [aComment(person("ana"), "This file should not be in this pull request.")],
      false,
      Option.some({ path: "src/one.ts" })
    )

    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane({ threads: [whole] })}</SettingsProvider>
      </Theme>
    )

    expect((await drawn()).notes ?? []).toEqual([])
  })

  test("claims nothing while GitHub has not sent this file's diff", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>
          {pane({ threads: [far], file: { ...file, diff: Option.none() } })}
        </SettingsProvider>
      </Theme>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Fetching this file/)).toBeNull()
    })
    expect(screen.queryByLabelText("Said about this file")).toBeNull()
  })
})

describe("revealing the lines GitHub left out between the hunks", () => {
  /*
   * GitHub sends a file's hunks and three lines either side. The rest of the
   * file has to be fetched before the renderer can draw it, so the pane hands
   * over the way to fetch rather than the file: a file nobody expands costs no
   * request. See `docs/plan/comment-anywhere.md`, step 3.
   */
  const reading = (sha: string, path: string) => Effect.succeed(`${path} at ${sha}`)

  test("hands the renderer a way to fetch the rest of a changed file", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>
          {pane({ revealing: revealer(reading, { base: "base", head: "head" }) })}
        </SettingsProvider>
      </Theme>
    )

    expect(typeof (await drawn()).reveal).toBe("function")
  })

  test("that way answers with both halves of the file", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>
          {pane({ revealing: revealer(reading, { base: "base", head: "head" }) })}
        </SettingsProvider>
      </Theme>
    )

    expect(await (await drawn()).reveal!()).toEqual({
      before: "src/one.ts at base",
      after: "src/one.ts at head"
    })
  })

  test("offers none for a file the pull request deleted", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>
          {pane({
            revealing: revealer(reading, { base: "base", head: "head" }),
            file: { ...file, changeType: "deleted" }
          })}
        </SettingsProvider>
      </Theme>
    )

    expect((await drawn()).reveal).toBeUndefined()
  })

  test("offers none at all where nothing can fetch a file", async () => {
    render(
      <Theme>
        <SettingsProvider store={holding(DEFAULTS)}>{pane()}</SettingsProvider>
      </Theme>
    )

    expect((await drawn()).reveal).toBeUndefined()
  })
})
