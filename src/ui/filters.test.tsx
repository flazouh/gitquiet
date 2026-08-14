import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Filters } from "./Filters"

afterEach(cleanup)

const showing = (
  query = "",
  authors: ReadonlyArray<string> = ["flazouh", "octocat"],
  repos: ReadonlyArray<string> = ["oven-sh/bun", "flazouh/octo-repo"]
) => {
  let asked = query
  const view = render(
    <Filters
      query={query}
      authors={authors}
      repos={repos}
      viewer="flazouh"
      what="the Working Set"
      onQuery={(next) => {
        asked = next
      }}
    />
  )

  return { ...view, asked: () => asked }
}

const chip = (name: RegExp) => screen.getByRole("button", { name })

describe("the filter row above a list", () => {
  test("gives the reader one box and a chip per kind of question", () => {
    showing()

    expect(screen.getByRole("searchbox", { name: /Filter/ })).toBeDefined()
    for (const name of [/Author/, /Repository/, /Checks/, /Review/, /State/, /Activity/]) {
      expect(chip(name)).toBeDefined()
    }
  })

  test("keeps its menus out of the document until one is opened", async () => {
    // The keyboard walk pauses while a menu is up, and it asks the document
    // whether one is. A menu rendered shut is a walk that never works again.
    const { container } = showing()

    expect(container.querySelector('[role="menu"]')).toBeNull()

    await userEvent.click(chip(/Checks/))

    expect(container.querySelector('[role="menu"]')).not.toBeNull()
  })

  test("writes the term the reader pointed at into the box", async () => {
    const { asked } = showing()

    await userEvent.click(chip(/Checks/))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /Failing/ }))

    expect(asked()).toBe("is:failing")
  })

  test("takes a term back out when it is pointed at again", async () => {
    const { asked } = showing("author:me is:failing")

    await userEvent.click(chip(/Checks/))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /Failing/ }))

    expect(asked()).toBe("author:me")
  })

  test("shows which terms are on, so the box is not the only place to look", async () => {
    showing("is:failing")

    await userEvent.click(chip(/Checks/))

    expect(
      screen.getByRole("menuitemcheckbox", { name: /Failing/ }).getAttribute("aria-checked")
    ).toBe("true")
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Passing/ }).getAttribute("aria-checked")
    ).toBe("false")
  })

  test("says on the chip itself how many of its terms are on", () => {
    showing("is:failing is:running")

    expect(chip(/Checks/).textContent).toContain("2")
  })

  test("offers the authors who are actually on the screen, and the reader themselves", async () => {
    showing("", ["octocat"])

    await userEvent.click(chip(/Author/))
    const menu = screen.getByRole("menu")

    expect(within(menu).getByRole("menuitemcheckbox", { name: /Mine/ })).toBeDefined()
    expect(within(menu).getByRole("menuitemcheckbox", { name: /octocat/ })).toBeDefined()
  })

  test("puts each author behind their own face, as the rows do", async () => {
    // A person is recognised rather than read. The same component the rows use,
    // so a face here and a face there are the same picture of the same account.
    showing("", ["octocat"])

    await userEvent.click(chip(/Author/))
    const menu = screen.getByRole("menu")

    expect(within(menu).getByLabelText("octocat")).toBeDefined()
    // "Mine" is the reader's own face rather than a word standing in for one.
    expect(within(menu).getByLabelText("flazouh")).toBeDefined()
  })

  test("offers the repositories the rows are in, each behind its owner's picture", async () => {
    // The same trick the Author chip plays. A list of every repository on GitHub
    // would be a search box; what is useful is the handful in front of the reader.
    showing("", ["octocat"], ["oven-sh/bun"])

    await userEvent.click(chip(/Repository/))
    const menu = screen.getByRole("menu")

    expect(within(menu).getByRole("menuitemcheckbox", { name: /bun/ })).toBeDefined()
    expect(within(menu).getByLabelText("oven-sh")).toBeDefined()
  })

  test("writes the repository the reader pointed at, named in full", async () => {
    // In full, because two owners can name a repository the same way and the
    // line has to say which one was asked for.
    const { asked } = showing("", ["octocat"], ["oven-sh/bun"])

    await userEvent.click(chip(/Repository/))
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /bun/ }))

    expect(asked()).toBe("repo:oven-sh/bun")
  })

  test("leaves the chip out where every row is in one repository", () => {
    // A repository's own list already says which one above the rows, so a chip
    // offering the only answer is a control that cannot change anything.
    showing("", ["octocat"], [])

    expect(screen.queryByRole("button", { name: /Repository/ })).toBeNull()
  })

  test("draws each state in the tone a row draws it in", async () => {
    // The menu is where the vocabulary is learned: the red beside Failing is the
    // red on the row it will leave on the screen.
    showing()

    await userEvent.click(chip(/Checks/))
    const menu = screen.getByRole("menu")

    const failing = within(menu).getByRole("menuitemcheckbox", { name: /Failing/ })
    const passing = within(menu).getByRole("menuitemcheckbox", { name: /Passing/ })

    expect(failing.querySelector(".text-fail")).not.toBeNull()
    expect(passing.querySelector(".text-pass")).not.toBeNull()
  })

  test("wears the mark of the one term it is filtered to, without being opened", () => {
    const { container } = showing("is:failing")

    expect(chip(/Checks/).querySelector(".text-fail")).not.toBeNull()
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  test("shuts on escape, leaving the walk through the list working again", async () => {
    // Immediately, rather than once it has finished shrinking: the ghost keeps its
    // shape for a hundred and fifty milliseconds but stops being a menu at once,
    // and the keyboard walk is paused by anything that still is one.
    const { container } = showing()

    await userEvent.click(chip(/Checks/))
    await userEvent.keyboard("{Escape}")

    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  test("goes at once on escape, leaving nothing behind to shrink", async () => {
    // This asserted the opposite until the account and repository menus stopped
    // lingering on Escape, and one key doing two different things to two menus in the
    // same row of the same interface is worse than either answer on its own. A key is
    // not a hand: the ghost is there so a pointer travelling away has something to
    // travel from, and a reader who pressed Escape has already left.
    const { container } = showing()

    await userEvent.click(chip(/Checks/))
    await userEvent.keyboard("{Escape}")

    expect(container.querySelector(".t-menu")).toBeNull()
  })

  test("lets the menu shrink away for a press elsewhere, which is a hand leaving", async () => {
    const { container } = showing()

    await userEvent.click(chip(/Checks/))
    await userEvent.click(document.body)

    // Still there, and told to be leaving, which is what the stylesheet animates.
    expect(container.querySelector(".t-menu.is-closing")).not.toBeNull()

    await waitFor(() => expect(container.querySelector(".t-menu") === null).toBe(true), {
      timeout: 1000
    })
  })

  test("opens the menu from the chip rather than from the middle of the page", async () => {
    showing()

    await userEvent.click(chip(/Checks/))

    const menu = screen.getByRole("menu")

    expect(menu.className).toContain("t-menu")
    expect(menu.getAttribute("data-origin")).toBe("top-left")
  })

  test("settles into the state that holds it open", async () => {
    // The frame of rest before it — the one that gives the open somewhere to
    // travel from — is not observable here: this environment's animation frame is
    // flushed along with the effect that asked for it. The browser measurement in
    // the commit that added this is what holds that half up.
    showing()

    await userEvent.click(chip(/Checks/))

    await waitFor(() => expect(screen.getByRole("menu").getAttribute("data-phase")).toBe("here"))
    expect(screen.getByRole("menu").className).toContain("is-open")
  })

  test("opens one menu at a time", async () => {
    showing()

    await userEvent.click(chip(/Checks/))
    await userEvent.click(chip(/State/))

    expect(screen.getAllByRole("menu")).toHaveLength(1)
    expect(screen.getByRole("menuitemcheckbox", { name: /Draft/ })).toBeDefined()
  })

  test("clears everything at once, once there is anything to clear", async () => {
    const { asked } = showing("cache the tokenizer is:failing author:me")

    await userEvent.click(screen.getByRole("button", { name: /Clear/ }))

    expect(asked()).toBe("")
  })

  test("offers nothing to clear when nothing has been asked", () => {
    showing("")

    expect(screen.queryByRole("button", { name: /Clear/ })).toBeNull()
  })
})
