import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { DiffHandle, DiffPreparation, DiffRequest } from "../ports/Renderer"
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
const prepared: Array<DiffPreparation> = []
let destroyed = 0

const handle: DiffHandle = {
  onThemeChange: () => {},
  showNotes: () => {},
  unpick: () => {},
  destroy: () => void (destroyed += 1)
}

const stub: LoadEngine = Effect.succeed({
  prepareDiff: (_container: HTMLElement, request: DiffPreparation) =>
    Effect.sync(() => prepared.push(request)),
  renderDiff: (_container: HTMLElement, request: DiffRequest) => {
    asked.push(request)
    return handle
  }
})

afterEach(() => {
  cleanup()
  asked.length = 0
  prepared.length = 0
  destroyed = 0
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

const pane = (props: Partial<React.ComponentProps<typeof FileDiffPane>> = {}) => (
  <RendererProvider load={stub}>
    <FileDiffPane
      file={file}
      ask={() => Effect.succeed(Option.none())}
      choices={diffChoices(DEFAULTS.diff)}
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

describe("preparing the other way to read prose", () => {
  test("warms the code renderer while the document is already visible", async () => {
    render(pane({ file: { ...file, path: "README.md" }, reading: true }))

    await waitFor(() => expect(prepared).toHaveLength(1))
    expect(prepared[0]?.path).toBe("README.md")
    expect(prepared[0]?.patch).toContain("+ two")
    expect(asked).toHaveLength(0)
  })

  test("keeps both drawings after the reader switches each way", async () => {
    const prose = { ...file, path: "README.md" }
    const choices = diffChoices(DEFAULTS.diff)
    const view = render(pane({ file: prose, reading: true, choices }))
    await waitFor(() => expect(prepared).toHaveLength(1))

    view.rerender(pane({ file: prose, reading: false, choices }))
    await waitFor(() => expect(asked).toHaveLength(1))

    view.rerender(pane({ file: prose, reading: true, choices }))
    await waitFor(() => {
      expect(document.querySelector("[data-gitquiet-prose-runs]")).not.toBeNull()
    })
    expect(asked).toHaveLength(1)
    expect(destroyed).toBe(0)
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
