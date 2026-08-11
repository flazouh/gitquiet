import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Commit } from "../domain/PullRequest"
import { type Box, NEAR } from "./near"
import { Commits } from "./Commits"

afterEach(cleanup)

const commit = (sha: string, headline: string, createdAt = "2026-07-27T20:00:00Z"): Commit => ({
  sha: `${sha}0000000000000000000000000000000000`.slice(0, 40),
  abbreviatedSha: sha,
  author: "flazouh",
  headline,
  createdAt
})

const three = [commit("aaa1111", "add the gateway"), commit("bbb2222", "fix lint"), commit("ccc3333", "fix lint again")]

/** jsdom lays nothing out, so the rows this test needs are stated outright. */
const layOut = (rects: Record<string, Box>) => {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const key = this.getAttribute(NEAR) ?? (this.tagName === "DIV" ? "list" : "")
    const found = rects[key] ?? { left: 0, top: 0, right: 0, bottom: 0 }
    return {
      ...found,
      width: 0,
      height: 0,
      x: found.left,
      y: found.top,
      toJSON: () => ""
    } as DOMRect
  }
  return () => {
    Element.prototype.getBoundingClientRect = original
  }
}

describe("the commits section", () => {
  test("keeps them out of the way until they are asked for", () => {
    render(<Commits commits={three} />)

    expect(screen.getByText(/^3, newest /)).toBeDefined()
    // Rendered, but inside a closed details: the wall stays down until a click.
    expect(screen.getByText("add the gateway").closest("details")?.open).toBe(false)
  })

  test("shows sha, subject, face and age once opened", async () => {
    render(<Commits commits={three} />)

    await userEvent.click(screen.getByText("Show them"))

    expect(screen.getByText("add the gateway").closest("details")?.open).toBe(true)
    expect(screen.getByText("bbb2222")).toBeDefined()
    // The author is a face with the login on it, not a column of ragged names.
    expect(screen.getAllByLabelText("flazouh")).toHaveLength(3)
    expect(screen.queryAllByText("flazouh")).toHaveLength(0)
    expect(screen.getAllByTitle(/2026/)).toHaveLength(3)
  })

  test("counts one as one, and says nothing about what merging would do to it", () => {
    render(<Commits commits={[commit("aaa1111", "add the gateway")]} />)

    expect(screen.getByText(/^one, /)).toBeDefined()
    expect(screen.queryByText(/squash/i)).toBeNull()
  })

  test("reports the age of the newest, whatever order they arrived in", () => {
    render(
      <Commits
        commits={[
          commit("aaa1111", "first", "2020-01-01T00:00:00Z"),
          commit("bbb2222", "last", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()),
          commit("ccc3333", "middle", "2021-01-01T00:00:00Z")
        ]}
      />
    )

    expect(screen.getByText("3, newest 3h ago")).toBeDefined()
  })

  test("leads back to the commit on GitHub", () => {
    render(<Commits commits={three} repository={{ owner: "flazouh", repo: "ghpro", number: 4 }} />)

    const link = screen.getByText("bbb2222").closest("a")

    expect(link?.getAttribute("href")).toBe(
      `https://github.com/flazouh/ghpro/commit/${three[1]?.sha}`
    )
  })

  test("reads a commit as the pointer comes near its row", async () => {
    const [first, second, third] = three.map((commit) => commit.sha)
    const restore = layOut({
      list: { left: 0, top: 0, right: 300, bottom: 430 },
      [first ?? ""]: { left: 0, top: 0, right: 300, bottom: 30 },
      [second ?? ""]: { left: 0, top: 30, right: 300, bottom: 60 },
      // Far down a scrolled list, where the pointer is nowhere near it.
      [third ?? ""]: { left: 0, top: 400, right: 300, bottom: 430 }
    })
    const warmed: Array<string> = []
    render(<Commits commits={three} onWarm={(sha) => warmed.push(sha)} />)

    await userEvent.click(screen.getByText("Show them"))
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150, clientY: 15 }))

    // The row under the pointer and its neighbour, which is the one a moving
    // pointer is about to reach.
    await waitFor(() => expect(warmed).toEqual([first ?? "", second ?? ""]))

    restore()
  })

  test("says nothing at all when none have arrived", () => {
    render(<Commits commits={[]} />)

    expect(screen.queryByText("Show them")).toBeNull()
  })
})
