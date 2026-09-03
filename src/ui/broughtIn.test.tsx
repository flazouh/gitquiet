import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { DEFAULTS, type Settings } from "../domain/Settings"
import type { DiffHandle, DiffRequest } from "../ports/Renderer"
import type { Store } from "../ports/Settings"
import { BroughtIn } from "./BroughtIn"
import { RendererProvider, type LoadEngine } from "./renderer"
import { SettingsProvider } from "./settings"
import { Theme } from "./Theme"

/**
 * Bringing in a file the pull request did not change, and quoting it.
 *
 * The renderer is stood in for, as it is everywhere else: it is four and a half
 * megabytes behind an extension URL and writes into a shadow root, neither of
 * which exists in here. What it was asked to draw is readable, which is the
 * part that matters, and the picking is driven through the request it was
 * handed rather than through a drag nothing here can perform.
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
})

const holding = (settings: Settings): Store => ({
  read: Effect.sync(() => settings),
  write: () => Effect.void,
  watch: () => () => {}
})

const PATHS = ["src/config.ts", "src/config/loader.ts", "src/ui/Files.tsx"]

const showing = (over: Partial<Parameters<typeof BroughtIn>[0]> = {}) =>
  render(
    <Theme>
      <SettingsProvider store={holding(DEFAULTS)}>
        <RendererProvider load={stub}>
          <BroughtIn
            repo={{ owner: "oven-sh", repo: "bun" }}
            headSha="f4a97b1e2c3d4a5b6c7d8e9f0a1b2c3d4e5f6a7b"
            paths={() => Effect.succeed(PATHS)}
            readFile={(path) => Effect.succeed(`// ${path} line one\n// line two\n// line three`)}
            onClose={() => {}}
            {...over}
          />
        </RendererProvider>
      </SettingsProvider>
    </Theme>
  )

describe("a file brought into a review", () => {
  test("says what it is for, and that what is said here is not a review thread", async () => {
    showing()

    expect(await screen.findByText(/Bring in a file this pull request did not change/)).toBeTruthy()
    expect(screen.getByText(/GitHub has none for a file outside the change/)).toBeTruthy()
  })

  test("offers no paths until something is typed, rather than every path there is", async () => {
    showing()

    expect(screen.queryByText("src/config.ts")).toBeNull()
  })

  test("offers the paths the typing names, the file's own name first", async () => {
    showing()

    await userEvent.type(screen.getByLabelText("Find a file"), "config")

    const offered = await screen.findAllByRole("button")
    const paths = offered.map((one) => one.textContent ?? "").filter((one) => one.includes("config"))
    expect(paths[0]).toContain("config.ts")
  })

  test("draws the whole file once one is chosen", async () => {
    showing()

    await userEvent.type(screen.getByLabelText("Find a file"), "loader")
    await userEvent.click(await screen.findByRole("button", { name: /loader\.ts/ }))

    expect(await screen.findByText(/Mark some lines/)).toBeTruthy()
    expect(asked).toHaveLength(1)
    expect(asked[0]!.path).toBe("src/config/loader.ts")
    // Every line is context, because nothing happened to this file.
    expect(asked[0]!.patch).toContain(" // src/config/loader.ts line one")
    // And the lines are pickable, which is the whole reason it is drawn here.
    expect(typeof asked[0]!.onPick).toBe("function")
  })

  test("sends what was marked to the conversation, as an address and a sentence", async () => {
    const said: Array<string> = []

    showing({
      onSay: (body) => {
        said.push(body)
        return Effect.void
      }
    })

    await userEvent.type(screen.getByLabelText("Find a file"), "loader")
    await userEvent.click(await screen.findByRole("button", { name: /loader\.ts/ }))

    const request = asked[0]!
    request.onPick?.({ side: "additions", from: 2, to: 3 })

    await userEvent.type(await screen.findByRole("textbox"), "The old flag order is assumed here.")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    expect(said).toEqual([
      "https://github.com/oven-sh/bun/blob/f4a97b1e2c3d4a5b6c7d8e9f0a1b2c3d4e5f6a7b/src/config/loader.ts#L2-L3\n\nThe old flag order is assumed here."
    ])
  })

  test("names one line rather than a run where only one was marked", async () => {
    const said: Array<string> = []

    showing({
      onSay: (body) => {
        said.push(body)
        return Effect.void
      }
    })

    await userEvent.type(screen.getByLabelText("Find a file"), "loader")
    await userEvent.click(await screen.findByRole("button", { name: /loader\.ts/ }))

    asked[0]!.onPick?.({ side: "additions", from: 2, to: 2 })

    await userEvent.type(await screen.findByRole("textbox"), "This one.")
    await userEvent.click(screen.getByRole("button", { name: "Comment" }))

    expect(said[0]).toContain("/src/config/loader.ts#L2\n\n")
  })

  test("says so where the file cannot be read at that commit", async () => {
    showing({ readFile: () => Effect.fail(new Error("404")) })

    await userEvent.type(screen.getByLabelText("Find a file"), "loader")
    await userEvent.click(await screen.findByRole("button", { name: /loader\.ts/ }))

    expect(await screen.findByText(/could not be read at this commit/)).toBeTruthy()
  })

  test("gives back the diff it replaced", async () => {
    let closed = 0
    showing({ onClose: () => (closed += 1) })

    await userEvent.click(screen.getByRole("button", { name: "Back to the diff" }))

    expect(closed).toBe(1)
  })
})
