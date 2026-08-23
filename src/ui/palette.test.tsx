import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { Palette } from "./Palette"
import type { Repository } from "../domain/repositories"

afterEach(cleanup)

const repository = (nameWithOwner: string): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false
  }
}

const REPOSITORIES = [
  repository("flowline-labs/flowline"),
  repository("flazouh/gitquiet"),
  repository("flazouh/ego-browser")
]

const OWED = [
  {
    kind: "pull-request" as const,
    reference: { owner: "flowline-labs", repo: "flowline", number: 1934 },
    title: "canonical component library"
  }
]

const showing = (over: { readonly onShut?: () => void } = {}) =>
  render(
    <Palette
      repositories={REPOSITORIES}
      owed={OWED}
      onShut={over.onShut ?? (() => undefined)}
    />
  )

/**
 * The links pressed, read the way the page reads them.
 *
 * A press on an answer is a real click on a real anchor, bubbling out of the
 * palette for the document to answer — that is the whole change from `onGo`.
 * So the test stands where the shell stands, above the dialog, and records
 * what came through.
 */
const answering = (): Array<string> => {
  const went: Array<string> = []
  screen.getByRole("dialog").addEventListener(
    "click",
    (event) => {
      event.preventDefault()
      const target = event.target
      const link = target instanceof Element ? target.closest("a") : null
      if (link !== null) went.push(link.getAttribute("href") ?? "")
    },
    { capture: true }
  )
  return went
}

const options = () => screen.getAllByRole("option").map((one) => one.textContent)

describe("the palette", () => {
  test("opens on what is owed, before anything is typed", () => {
    showing()

    expect(options()[0]).toContain("canonical component library")
  })

  test("takes the caret without a press, because it was opened by a key", () => {
    showing()

    expect(document.activeElement).toBe(screen.getByRole("combobox"))
  })

  test("narrows as the reader types, with no request to wait for", async () => {
    showing()
    await userEvent.type(screen.getByRole("combobox"), "ego")

    // The owner's initial comes first: a repository is drawn with a face, and the face of an
    // owner GitHub gave no picture for is their first letter.
    expect(options()).toEqual(["fflazouh/ego-browser"])
  })

  test("every answer is a link, so a press is a press on an address", () => {
    showing()

    for (const one of screen.getAllByRole("option")) {
      expect(one.tagName).toBe("A")
      expect(one.getAttribute("href")).not.toBeNull()
    }
  })

  test("stands on the first answer, so Enter needs no arrow first", async () => {
    showing()
    const went = answering()

    await userEvent.type(screen.getByRole("combobox"), "gitquiet{Enter}")

    expect(went).toEqual(["/flazouh/gitquiet/pulls"])
  })

  test("walks the answers with the arrows", async () => {
    showing()
    const went = answering()

    await userEvent.type(screen.getByRole("combobox"), "flazouh")
    await userEvent.keyboard("{ArrowDown}{Enter}")

    expect(went).toEqual(["/flazouh/ego-browser/pulls"])
  })

  test("does not walk off either end of the list", async () => {
    showing()
    const went = answering()

    await userEvent.type(screen.getByRole("combobox"), "flazouh")
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}")

    expect(went).toEqual(["/flazouh/gitquiet/pulls"])
  })

  test("says which one Enter would take, rather than leaving it to be guessed", async () => {
    showing()
    await userEvent.type(screen.getByRole("combobox"), "flazouh{ArrowDown}")

    expect(screen.getByRole("option", { selected: true }).textContent).toContain(
      "flazouh/ego-browser"
    )
  })

  test("takes a press on an answer as well as a key, and shuts behind it", async () => {
    let shut = 0
    showing({ onShut: () => (shut += 1) })
    const went = answering()

    await userEvent.click(screen.getByRole("option", { name: /ego-browser/ }))

    expect(went).toEqual(["/flazouh/ego-browser/pulls"])
    expect(shut).toBe(1)
  })

  test("shuts on Escape", async () => {
    let shut = 0
    showing({ onShut: () => (shut += 1) })

    await userEvent.keyboard("{Escape}")

    expect(shut).toBe(1)
  })

  test("says so plainly when nothing matches, rather than looking broken", async () => {
    showing()
    await userEvent.type(screen.getByRole("combobox"), "zzzz")

    expect(screen.queryAllByRole("option")).toEqual([])
    expect(screen.getByRole("dialog").textContent).toContain("Nothing here goes by that")
  })
})
