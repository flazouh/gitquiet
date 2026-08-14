import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { ListedIssue } from "../domain/issues"
import { drawingIssues, issueDrawn } from "./rows"

const aWindow = () => ({}) as Window

const rowFor = (
  reference: { readonly owner: string; readonly repo: string; readonly number: number },
  title: string
): ListedIssue => ({
  reference,
  id: `I_${reference.owner}_${reference.repo}_${reference.number}`,
  title,
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  comments: 2,
  labels: ["bug"],
  raisedAt: "2026-07-28T20:07:00Z"
})

const here = { owner: "flazouh", repo: "githubpro", number: 146 }

describe("the issue rows a list has on the screen", () => {
  test("says nothing about an issue no list has drawn", () => {
    expect(issueDrawn(aWindow(), here)).toBeUndefined()
  })

  test("hands back the row for the issue asked about", () => {
    const world = aWindow()
    const row = rowFor(here, "The Courts hold only half of what is owed")

    drawingIssues(world, [row])

    expect(issueDrawn(world, here)).toBe(row)
  })

  test("tells two issues of the same repository apart", () => {
    const world = aWindow()
    const other = { ...here, number: 147 }

    drawingIssues(world, [rowFor(here, "This one"), rowFor(other, "The other one")])

    expect(issueDrawn(world, other)?.title).toBe("The other one")
  })

  test("tells two repositories holding the same number apart", () => {
    // The number alone is not an issue. Every repository has a 146, and a row
    // matched on it would put another project's title over this one's page.
    const world = aWindow()
    const elsewhere = { owner: "oven-sh", repo: "bun", number: 146 }

    drawingIssues(world, [rowFor(elsewhere, "Somebody else's 146")])

    expect(issueDrawn(world, here)).toBeUndefined()
  })

  test("the page on the screen replaces the page before it", () => {
    const world = aWindow()
    drawingIssues(world, [rowFor(here, "As the first page had it")])

    drawingIssues(world, [rowFor({ ...here, number: 147 }, "The second page")])

    expect(issueDrawn(world, here)).toBeUndefined()
  })

  test("says nothing where the list drew no issues at all", () => {
    const world = aWindow()

    drawingIssues(world, [])

    expect(issueDrawn(world, here)).toBeUndefined()
  })
})
