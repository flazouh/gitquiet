import { describe, expect, it } from "bun:test"
import { renderRanges, SURFACES, shadowFor } from "./engine"

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

describe("a long diff entering the page", () => {
  it("keeps each default reveal below one frame of DOM work", () => {
    expect(renderRanges(17, 20)).toEqual([
      { startingLine: 0, totalLines: 4, bufferBefore: 0, bufferAfter: 260 },
      { startingLine: 0, totalLines: 8, bufferBefore: 0, bufferAfter: 180 },
      { startingLine: 0, totalLines: 12, bufferBefore: 0, bufferAfter: 100 },
      { startingLine: 0, totalLines: 16, bufferBefore: 0, bufferAfter: 20 },
      { startingLine: 0, totalLines: 17, bufferBefore: 0, bufferAfter: 0 }
    ])
  })

  it("grows in bounded ranges while its full scroll height stays reserved", () => {
    expect(renderRanges(45, 20, 16)).toEqual([
      { startingLine: 0, totalLines: 16, bufferBefore: 0, bufferAfter: 580 },
      { startingLine: 0, totalLines: 32, bufferBefore: 0, bufferAfter: 260 },
      { startingLine: 0, totalLines: 45, bufferBefore: 0, bufferAfter: 0 }
    ])
  })
})
