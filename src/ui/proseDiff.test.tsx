import { render } from "@testing-library/react"
import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { DiffLine, FileDiff } from "../domain/PullRequest"
import { ProseDiff } from "./ProseDiff"

const line = (kind: DiffLine["kind"], text: string): DiffLine => ({
  kind,
  text,
  beforeLine: Option.none(),
  afterLine: Option.none()
})

const diff: FileDiff = {
  isBinary: false,
  isTruncated: false,
  lines: [line("context", " first"), line("added", "+second")]
}

describe("ProseDiff", () => {
  test("keeps markdown runs ready inside a cached file", () => {
    const view = render(<ProseDiff diff={diff} />)
    const runs = view.container.querySelectorAll<HTMLElement>("[data-change]")

    expect(runs).toHaveLength(2)
    expect([...runs].map((run) => run.style.contentVisibility)).toEqual(["", ""])
    expect([...runs].map((run) => run.style.containIntrinsicSize)).toEqual(["", ""])
  })
})
