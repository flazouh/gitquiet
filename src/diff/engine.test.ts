import { describe, expect, it, test } from "bun:test"
import { held, named, sameName, SURFACES, shadowFor } from "./engine"

/**
 * The one line in the engine that behaves differently on the two platforms.
 *
 * A content script has no custom element registry, so `<diffs-container>` never
 * upgrades and never attaches its own shadow root. A window has a real one, so the
 * element upgrades the moment it is created and has attached one already — and
 * `attachShadow` on a host that has one throws `NotSupportedError`, which threw out
 * of a mount effect and unmounted the whole card. The pull request had been read
 * correctly; the window went blank.
 */
describe("the shadow root a diff is drawn into", () => {
  it("attaches one where nothing has", () => {
    const host = document.createElement("div")

    const shadow = shadowFor(host)
    expect(host.shadowRoot).toBe(shadow)
  })

  it("uses the one an upgraded element attached for itself", () => {
    const host = document.createElement("div")
    const already = host.attachShadow({ mode: "open" })

    expect(shadowFor(host)).toBe(already)
  })

  it("does not ask twice for the same host", () => {
    const host = document.createElement("div")

    const first = shadowFor(host)
    expect(() => shadowFor(host)).not.toThrow()
    expect(shadowFor(host)).toBe(first)
  })
})

describe("the surfaces a diff sits on", () => {
  it("hovers with the pack's hover, not GitHub's muted fill", () => {
    expect(SURFACES["--diffs-bg-hover-override"]).toBe("var(--color-hover)")
  })

  it("uses the pack's mono, then GitHub's, then a system stack", () => {
    expect(SURFACES["--diffs-font-family"]).toContain("--font-mono")
    expect(SURFACES["--diffs-font-family"]).toContain("--fontStack-monospace")
  })
})

describe("the identifier under the pointer", () => {
  const token = {
    lineNumber: 42,
    lineCharStart: 8,
    lineCharEnd: 16,
    tokenText: "renderDiff",
    side: "additions" as const
  }

  it("is carried over with the renderer's columns under this file's words", () => {
    expect(named(token)).toEqual({
      line: 42,
      from: 8,
      to: 16,
      text: "renderDiff",
      side: "additions"
    })
  })

  it("has no side in a file that is not a diff, rather than a guessed one", () => {
    const { side: _side, ...file } = token

    expect("side" in named(file)).toBe(false)
  })
})

describe("what the reader was holding", () => {
  const nothing = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

  it("reads Command and Control as the same intent, which is the platform's rule", () => {
    expect(held({ ...nothing, metaKey: true }).go).toBe(true)
    expect(held({ ...nothing, ctrlKey: true }).go).toBe(true)
    expect(held(nothing).go).toBe(false)
  })

  it("carries Shift and Alt without deciding anything about them", () => {
    expect(held({ ...nothing, shiftKey: true, altKey: true })).toEqual({
      go: false,
      shift: true,
      alt: true
    })
  })
})

describe("whether a Name is the one the pointer is on", () => {
  const name = { line: 7, from: 2, to: 5, text: "one", side: "additions" as const }

  it("is the same Name rebuilt, because a pane may hand back a new object", () => {
    expect(sameName(name, { ...name })).toBe(true)
  })

  it("is not the same line, the same column, or the same side", () => {
    expect(sameName(name, { ...name, line: 8 })).toBe(false)
    expect(sameName(name, { ...name, from: 3 })).toBe(false)
    expect(sameName(name, { ...name, side: "deletions" })).toBe(false)
  })

  it("does not read the text, which is the same word in a hundred places", () => {
    expect(sameName(name, { ...name, text: "other" })).toBe(true)
  })
})

describe("which half of the file a line belongs to", () => {
  const lineOf = (kind: string | null): HTMLElement => {
    const row = document.createElement("div")
    if (kind !== null) row.setAttribute("data-line-type", kind)
    const token = document.createElement("span")
    row.append(token)
    return token
  }

  const token = (kind: string | null, side: "additions" | "deletions") => ({
    lineNumber: 4,
    lineCharStart: 2,
    lineCharEnd: 8,
    tokenText: "shape",
    side,
    tokenElement: lineOf(kind)
  })

  test("reads a context line as the file as it is, whichever column drew it", () => {
    // The event answers with a column, and a context line is drawn in both. Read
    // as a deletion it stops every unchanged line in a diff from answering —
    // which is most of the lines in most diffs.
    expect(named(token("context", "deletions")).side).toBe("additions")
    expect(named(token("context", "additions")).side).toBe("additions")
  })

  test("reads an added line as the file as it is", () => {
    expect(named(token("change-addition", "additions")).side).toBe("additions")
  })

  test("reads a deleted line as the file as it was, which is another file", () => {
    expect(named(token("change-deletion", "deletions")).side).toBe("deletions")
  })

  test("takes the event's own word where the line does not say", () => {
    expect(named(token(null, "deletions")).side).toBe("deletions")
  })
})
