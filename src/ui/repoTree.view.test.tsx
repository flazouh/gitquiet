import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
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
