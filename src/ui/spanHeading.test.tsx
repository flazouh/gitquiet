import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import type { Commit, Span } from "../domain/blame"
import { SpanHeading } from "./SpanHeading"

afterEach(cleanup)

const commit = (over: Partial<Commit> = {}): Commit => ({
  oid: "f0c283c",
  message: "Add Bun logo\n\nAnd centre it, while at it.",
  authorAvatarUrl: "https://avatars.githubusercontent.com/u/1",
  committerName: "Jarred Sumner",
  committedDate: "2022-07-06T04:12:45.000-07:00",
  ...over
})

const span = (over: Partial<Span> = {}): Span => ({
  start: 1,
  end: 3,
  commit: commit(),
  repeat: false,
  ...over
})

describe("a Span's heading", () => {
  test("tells the commit once: who, the message's first line, and when", () => {
    render(<SpanHeading span={span()} />)

    expect(screen.getByText("Jarred Sumner")).toBeTruthy()
    expect(screen.getByText("Add Bun logo")).toBeTruthy()
    expect(screen.queryByText(/centre it/)).toBeNull()
  })

  test("draws a Repeat thin: the message named, no face and no name again", () => {
    render(<SpanHeading span={span({ repeat: true })} />)

    expect(screen.getByText("Same as above:")).toBeTruthy()
    expect(screen.getByText("Add Bun logo")).toBeTruthy()
    expect(screen.queryByText("Jarred Sumner")).toBeNull()
    // The face goes with the name: `Face` hides its picture from readers, so
    // the absence is asked of the element rather than of an accessible image.
    expect(document.querySelector("img")).toBeNull()
  })
})
