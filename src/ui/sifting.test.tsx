import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { CommitList } from "../domain/commitList"
import { Authors, Dates } from "./Sifting"

afterEach(() => {
  cleanup()
  went.length = 0
})

const list = (search = ""): CommitList => ({
  repo: { owner: "flazouh", repo: "githubpro" },
  branch: Option.some("main"),
  search
})

const person = (login: string) => ({
  login,
  isAutomated: false,
  faceUrl: Option.some(`https://avatars.test/${login}.png`)
})

const went: Array<string> = []

const authors = (search = "") =>
  render(
    <Authors
      list={list(search)}
      onGo={(path) => went.push(path)}
      load={(partly) => Effect.sync(() => {
        const found = [person("flazouh"), person("octo")]
        partly(found)
        return found
      })}
    />
  )

describe("whose commits the page is showing", () => {
  test("says everybody, in their own words, until somebody is picked", () => {
    authors()

    expect(screen.getByRole("button", { name: "Author: All users" })).toBeDefined()
  })

  test("names the person the address is already narrowed to", () => {
    authors("author=octo")

    expect(screen.getByRole("button", { name: "Author: octo" })).toBeDefined()
  })

  test("offers everybody who has written a commit, once it is opened", async () => {
    const who = userEvent.setup()
    authors()

    await who.click(screen.getByRole("button", { name: /Author/ }))

    expect(screen.getByRole("menuitem", { name: "octo" }).getAttribute("href")).toBe(
      "/flazouh/githubpro/commits/main?author=octo"
    )
  })

  test("offers the way back to everybody, which is the row that matters most", async () => {
    const who = userEvent.setup()
    authors("author=octo")

    await who.click(screen.getByRole("button", { name: /Author/ }))

    expect(screen.getByRole("menuitem", { name: /All users/ }).getAttribute("href")).toBe(
      "/flazouh/githubpro/commits/main"
    )
  })

  test("reads nobody until it is opened, since most readers never narrow by person", () => {
    authors()

    expect(screen.queryByRole("menuitem")).toBeNull()
  })
})

describe("how far back the page goes", () => {
  test("says all time until a span is picked", () => {
    render(<Dates list={list()} onGo={(path) => went.push(path)} />)

    expect(screen.getByRole("button", { name: "Since: All time" })).toBeDefined()
  })

  test("says the date the address already starts at", () => {
    render(<Dates list={list("since=2026-07-01")} onGo={(path) => went.push(path)} />)

    expect(screen.getByRole("button", { name: "Since: Since 2026-07-01" })).toBeDefined()
  })

  test("offers spans, and writes each one as the day their filter takes", async () => {
    const who = userEvent.setup()
    render(<Dates list={list()} onGo={(path) => went.push(path)} />)

    await who.click(screen.getByRole("button", { name: /Since/ }))

    const week = screen.getByRole("menuitem", { name: "The last week" }).getAttribute("href")

    expect(week).toMatch(/^\/flazouh\/githubpro\/commits\/main\?since=\d{4}-\d{2}-\d{2}$/)
  })

  test("goes there itself, since GitHub moves within a repository without a load", async () => {
    const who = userEvent.setup()
    render(<Dates list={list()} onGo={(path) => went.push(path)} />)

    await who.click(screen.getByRole("button", { name: /Since/ }))
    await who.click(screen.getByRole("menuitem", { name: "The last week" }))

    expect(went).toHaveLength(1)
    expect(went[0]).toMatch(/\?since=\d{4}-\d{2}-\d{2}$/)
  })

  test("offers the way back to all of it", async () => {
    const who = userEvent.setup()
    render(<Dates list={list("since=2026-07-01")} onGo={(path) => went.push(path)} />)

    await who.click(screen.getByRole("button", { name: /Since/ }))

    expect(screen.getByRole("menuitem", { name: /All time/ }).getAttribute("href")).toBe(
      "/flazouh/githubpro/commits/main"
    )
  })
})
