import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Entry, Touch } from "../domain/repoHome"
import { RepoTree } from "./RepoTree"

afterEach(cleanup)

const touch = (over: Partial<Touch> = {}): Touch => ({
  at: new Date().toISOString(),
  said: "Say what this is for",
  url: "/flowline-labs/flowline/commit/def",
  oid: Option.some("def"),
  who: Option.none(),
  ...over
})

const entry = (name: string, over: Partial<Entry> = {}): Entry => ({
  name,
  path: name,
  kind: "file",
  touched: Option.none(),
  ...over
})

const showing = (over: Partial<Parameters<typeof RepoTree>[0]> = {}) =>
  render(
    <RepoTree
      entries={[
        entry("src", { kind: "directory", path: "src" }),
        entry("README.md", { touched: Option.some(touch()) })
      ]}
      repo={{ owner: "flowline-labs", repo: "flowline" }}
      branch="main"
      head="abc123"
      onOpen={() => {}}
      reading={null}
      {...over}
    />
  )

describe("the commit column on a row", () => {
  test("shows the message, the age, and a link to the commit", () => {
    showing()

    const link = screen.getByRole("link", { name: /Say what this is for/ })
    expect(link.getAttribute("href")).toBe("/flowline-labs/flowline/commit/def")
    expect(within(link).getByText("just now")).toBeTruthy()
  })

  test("leaves the column empty until the commit has landed", () => {
    showing({
      entries: [entry("README.md")]
    })

    expect(screen.getByText("README.md")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  test("draws the face when the author is known", () => {
    showing({
      entries: [
        entry("README.md", {
          touched: Option.some(
            touch({ who: Option.some({ login: "flazouh", face: Option.none() }) })
          )
        })
      ]
    })

    expect(screen.getByLabelText("flazouh")).toBeTruthy()
  })

  test("holds a face-sized slot before the author is known, so the message does not jump", () => {
    showing()

    const link = screen.getByRole("link", { name: /Say what this is for/ })
    const slot = link.querySelector("span.h-4.w-4")
    expect(slot).toBeTruthy()
    expect(within(link).queryByLabelText("flazouh")).toBeNull()
  })

  test("puts the full message on the truncated words, so a hover can read them", () => {
    showing({
      entries: [
        entry("README.md", {
          touched: Option.some(touch({ said: "Say what this is for in full" }))
        })
      ]
    })

    const words = screen.getByText("Say what this is for in full")
    expect(words.getAttribute("title")).toBe("Say what this is for in full")
  })

  test("paints today's age green, last week's amber, and older ages quieter", () => {
    const now = new Date("2026-08-12T12:00:00Z")
    const at = (name: string, iso: string, said: string) =>
      entry(name, { touched: Option.some(touch({ at: iso, said })) })

    showing({
      entries: [
        at("a.ts", "2026-08-12T10:00:00Z", "touched today"),
        at("b.ts", "2026-08-09T12:00:00Z", "touched this week"),
        at("c.ts", "2026-07-20T12:00:00Z", "touched this month"),
        at("d.ts", "2026-05-01T12:00:00Z", "touched earlier")
      ],
      now
    })

    expect(screen.getByRole("link", { name: /touched today/ }).className).toContain("text-pass")
    expect(screen.getByRole("link", { name: /touched this week/ }).className).toContain("text-busy")
    expect(screen.getByRole("link", { name: /touched this month/ }).className.split(" ")).toContain(
      "text-ink-muted"
    )
    expect(screen.getByRole("link", { name: /touched earlier/ }).className.split(" ")).toContain(
      "text-ink-muted/50"
    )
  })
})

describe("opening a file and a folder", () => {
  test("opens a file in the pane beside the tree", async () => {
    const opened: Array<string> = []
    showing({ onOpen: (path) => opened.push(path) })

    await userEvent.click(screen.getByRole("button", { name: "README.md" }))
    expect(opened).toEqual(["README.md"])
  })

  test("opens a folder onto the files under it once the whole tree has landed", async () => {
    showing({
      loadPaths: () => Effect.succeed(["src/ui/RepoTree.tsx", "README.md"])
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    expect(await screen.findByRole("button", { name: "ui" })).toBeTruthy()
  })

  test("fills the last commit on a nested row after the folder is opened", async () => {
    showing({
      loadPaths: () => Effect.succeed(["src/ui/RepoTree.tsx", "README.md"]),
      loadTouches: () =>
        Effect.succeed(
          new Map([
            [
              "src/ui",
              touch({ said: "The tree draws itself", url: "/flowline-labs/flowline/commit/nested" })
            ]
          ])
        )
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    const link = await screen.findByRole("link", { name: /The tree draws itself/ })
    expect(link.getAttribute("href")).toBe("/flowline-labs/flowline/commit/nested")
  })

  /*
   * The complaint behind this: a folder of many files is many unique commits,
   * and the faces are one read each. Held to the end, the messages arrive with
   * the last avatar rather than with their own route.
   */
  test("draws a nested message while the face behind it is still being read", async () => {
    const staged = new Map([
      ["src/ui", touch({ said: "The tree draws itself", url: "/flowline-labs/flowline/commit/nested" })]
    ])

    showing({
      loadPaths: () => Effect.succeed(["src/ui/RepoTree.tsx", "README.md"]),
      loadTouches: (_sha, _folder, partly) =>
        Effect.sync(() => partly(staged)).pipe(
          // The faces never land. The messages must not wait on them.
          Effect.flatMap(() => Effect.never)
        )
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    expect(await screen.findByRole("link", { name: /The tree draws itself/ })).toBeTruthy()
  })

  /*
   * The two stages are one request, and the first of them redraws the tree. A
   * list that treated that redraw as a reason to drop the read would show every
   * nested message with a hole where its face goes, for ever.
   */
  test("puts the face on a nested row, after the message the same read staged", async () => {
    const said = "The tree draws itself"
    const staged = new Map([["src/ui", touch({ said })]])
    const named = new Map([
      ["src/ui", touch({ said, who: Option.some({ login: "flazouh", face: Option.none() }) })]
    ])

    showing({
      loadPaths: () => Effect.succeed(["src/ui/RepoTree.tsx", "README.md"]),
      loadTouches: (_sha, _folder, partly) =>
        Effect.sync(() => partly(staged)).pipe(
          // A tick apart, as the two routes are. Together in one tick, the
          // redraw the first stage causes lands after the second is already in.
          Effect.flatMap(() => Effect.promise(() => new Promise((wake) => setTimeout(wake, 20)))),
          Effect.map(() => named)
        )
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    const link = await screen.findByRole("link", { name: /The tree draws itself/ })
    expect(await within(link).findByRole("img", { name: "flazouh" })).toBeTruthy()
  })
})

/*
 * happy-dom lays nothing out, so every height is zero and the tree draws every
 * row — which is what the rest of this file relies on. These two give it a
 * viewport of twenty rows to work with.
 */
const laidOut = () => {
  /*
   * Each on the prototype that already owns it: the rect on `Element`, the height
   * on `HTMLElement`. An own property put on the wrong one of those shadows the
   * right one for good — which is how a stub here quietly broke the rects
   * `near.test.tsx` lays out on `Element`.
   */
  const box = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect")
  const tall = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight")
  const down = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop")
  let scrolled = 0

  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    writable: true,
    value: () =>
      ({
        height: 24,
        width: 400,
        top: 0,
        left: 0,
        right: 400,
        bottom: 24,
        x: 0,
        y: 0,
        toJSON: () => ""
      }) as DOMRect
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 480
  })
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get: () => scrolled,
    set: (value: number) => {
      scrolled = value
    }
  })

  flatten = () => {
    if (box !== undefined) Object.defineProperty(Element.prototype, "getBoundingClientRect", box)
    if (tall !== undefined) Object.defineProperty(HTMLElement.prototype, "clientHeight", tall)
    if (down !== undefined) Object.defineProperty(Element.prototype, "scrollTop", down)
  }
}

/** A tab whose frames the browser has decided are not worth running. */
const stopFrames = () => {
  const frames = window.requestAnimationFrame
  window.requestAnimationFrame = () => 1
  const flat = flatten
  flatten = () => {
    window.requestAnimationFrame = frames
    flat?.()
  }
}

let flatten: (() => void) | undefined
afterEach(() => {
  flatten?.()
  flatten = undefined
})

describe("a tree too long to draw", () => {
  const thousands = Array.from({ length: 2000 }, (_, at) => `src/file${at}.ts`)

  test("draws the rows in front of the reader and not the two thousand behind them", async () => {
    laidOut()
    showing({ loadPaths: () => Effect.succeed(thousands) })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "file0.ts" })

    const drawn = document.querySelectorAll("[data-path]").length
    expect(drawn).toBeGreaterThan(20)
    expect(drawn).toBeLessThan(100)
  })

  test("keeps the scroll the height the whole list would have been", async () => {
    laidOut()
    const { container } = showing({ loadPaths: () => Effect.succeed(thousands) })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "file0.ts" })

    const rows = document.querySelectorAll("[data-path]").length
    const spacers = [...container.querySelectorAll("[aria-hidden]")]
      .map((one) => Number.parseInt((one as HTMLElement).style.height, 10))
      .filter((height) => Number.isFinite(height))
    const held = spacers.reduce((all, one) => all + one, 0)

    // The folder row and 2000 files and the README, minus the rows drawn.
    expect(rows).toBeLessThan(100)
    expect(held).toBe((2002 - rows) * 24)
  })

  /*
   * A browser throttles frames for a tab it decides is not worth painting fully,
   * and a machine under load delays them. The reader is still scrolling, so where
   * they are cannot be something this waits for a frame to find out.
   */
  test("follows a scroll that no frame ever arrives to answer", async () => {
    laidOut()
    stopFrames()
    showing({ loadPaths: () => Effect.succeed(thousands) })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "file0.ts" })

    const list = (document.querySelector("[data-path]") as HTMLElement).parentElement
    const first = () => (document.querySelector("[data-path]") as HTMLElement).dataset.path
    const started = first()

    if (list !== null) list.scrollTop = 3400
    list?.dispatchEvent(new Event("scroll"))

    await waitFor(() => expect(first()).not.toBe(started))
  })

  test("draws every row while nothing has been laid out, so nothing is lost", async () => {
    showing({ loadPaths: () => Effect.succeed(["src/ui/RepoTree.tsx", "README.md"]) })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    expect(await screen.findByRole("button", { name: "ui" })).toBeTruthy()
  })
})

describe("what a folder's column costs", () => {
  const deep = [
    "src/ui/RepoTree.tsx",
    "src/app/repoHome.ts",
    "src/domain/repoHome.ts",
    "src/github/repoHome.ts",
    "README.md"
  ]

  test("asks once for the folder that was pressed, and nothing for the rest", async () => {
    const asked: Array<string> = []
    showing({
      loadPaths: () => Effect.succeed(deep),
      loadTouches: (_sha, folder) => Effect.sync(() => asked.push(folder)).pipe(
        Effect.map(() => new Map<string, Touch>())
      )
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "ui" })

    expect(asked).toEqual(["src"])
  })

  /*
   * A hunt opens every folder holding a match. Asking each one for its own
   * column is one request per folder revealed, on every keystroke — hundreds of
   * them on a large repository, for a reader who is reading names.
   */
  test("asks for nothing when a hunt is what opened the folders", async () => {
    const asked: Array<string> = []
    showing({
      loadPaths: () => Effect.succeed(deep),
      loadTouches: (_sha, folder) => Effect.sync(() => asked.push(folder)).pipe(
        Effect.map(() => new Map<string, Touch>())
      )
    })

    await userEvent.type(screen.getByLabelText("Find a file"), "repoHome")
    // Three folders hold a match, and the hunt opens all three of them.
    expect(await screen.findAllByRole("button", { name: "repoHome.ts" })).toHaveLength(3)

    expect(asked).toEqual([])
  })

  test("asks again for a folder whose column failed, when it is opened again", async () => {
    let attempts = 0
    showing({
      loadPaths: () => Effect.succeed(deep),
      loadTouches: () =>
        Effect.sync(() => {
          attempts += 1
        }).pipe(Effect.flatMap(() => Effect.fail("no")))
    })

    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "ui" })
    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await userEvent.click(screen.getByRole("button", { name: "src" }))
    await screen.findByRole("button", { name: "ui" })

    expect(attempts).toBe(2)
  })
})
