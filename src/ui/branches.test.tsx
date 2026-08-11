import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { CommitList } from "../domain/commitList"
import { atBranch } from "../domain/commitList"
import { Branches } from "./Branches"

afterEach(() => {
  cleanup()
  went.length = 0
})

const list: CommitList = {
  repo: { owner: "flazouh", repo: "githubpro" },
  branch: Option.some("main"),
  search: ""
}

const went: Array<string> = []

const showing = (
  names: ReadonlyArray<string> = ["main", "next", "quiet-corners"],
  on = "main"
) =>
  render(
    <Branches
      at={(name) => atBranch(list, name)}
      on={on}
      onGo={(path) => went.push(path)}
      load={(partly) => Effect.sync(() => {
        partly(names)
        return names
      })}
    />
  )

const opened = async () => {
  const who = userEvent.setup()
  await who.click(screen.getByRole("button", { name: /branch/i }))
  return who
}

describe("the branch a page of commits is of", () => {
  test("is named on the control that changes it", () => {
    showing()

    expect(screen.getByRole("button", { name: /main/ })).toBeDefined()
  })

  test("offers every branch the repository has, once it is opened", async () => {
    showing()
    await opened()

    expect(screen.getByRole("menuitem", { name: "next" })).toBeDefined()
    expect(screen.getByRole("menuitem", { name: "quiet-corners" })).toBeDefined()
  })

  test("takes a press on one to that branch's own commits", async () => {
    showing()
    await opened()

    expect(screen.getByRole("menuitem", { name: "next" }).getAttribute("href")).toBe(
      "/flazouh/githubpro/commits/next"
    )
  })

  test("offers nothing until it is opened, since a repository has a thousand", () => {
    showing()

    expect(screen.queryByRole("menuitem")).toBeNull()
  })

  test("narrows to what is typed, which is the only way through a thousand", async () => {
    showing()
    const who = await opened()

    await who.keyboard("corn")

    expect(screen.getByRole("menuitem", { name: "quiet-corners" })).toBeDefined()
    expect(screen.queryByRole("menuitem", { name: "next" })).toBeNull()
  })

  test("goes there itself rather than letting the browser, since GitHub soft navigates", async () => {
    // A plain press on a real link changes the address and leaves this list
    // showing the branch it was already on: GitHub moves within a repository
    // without loading a page, so the screen has to be told.
    showing()
    const who = await opened()

    await who.click(screen.getByRole("menuitem", { name: "next" }))

    expect(went).toEqual(["/flazouh/githubpro/commits/next"])
  })

  test("marks the branch the page is already on", async () => {
    showing()
    await opened()

    const here = screen.getByRole("menuitem", { name: /^main/ })

    expect(here.querySelector("svg")).not.toBeNull()
    expect(screen.getByRole("menuitem", { name: "next" }).querySelector("svg")).toBeNull()
  })

  test("says so rather than drawing an empty menu, where nothing matches", async () => {
    showing()
    const who = await opened()

    await who.keyboard("zzz")

    expect(screen.getByText("Nothing by that name.")).toBeDefined()
  })
})
