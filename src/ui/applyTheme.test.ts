import { afterEach, describe, expect, it } from "bun:test"
import { PACK_KEY, paintTheme, rememberResolution, SCHEME_KEY } from "./applyTheme"

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

describe("painting a theme onto a root", () => {
  it("sets the pack's canvas", () => {
    const root = document.createElement("div")
    document.body.append(root)

    paintTheme(root, "dark", "gitquiet", false)

    expect(root.style.getPropertyValue("--color-canvas")).toBe("#171717")
    expect(root.style.getPropertyValue("--control")).toBe("#ffffff0f")
    expect(root.classList.contains("dark")).toBe(true)
  })

  it("follows the OS when appearance is system", () => {
    const root = document.createElement("div")
    document.body.append(root)

    paintTheme(root, "system", "anthropic", true)

    expect(root.style.getPropertyValue("--color-canvas")).toBe("#1a1814")
  })

  /*
   * Painting is not remembering. Anything may paint — a screen, the bar, a
   * second surface a later feature stands on the page — and a painter that also
   * wrote the early-paint keys is how two surfaces came to fight over what the
   * next page's first frame wore. Only the resolver remembers, and it says so
   * by calling `rememberResolution` itself.
   */
  it("writes nothing, however it is called", () => {
    const root = document.createElement("div")
    document.body.append(root)

    paintTheme(root, "dark", "dracula", false)

    expect(localStorage.getItem(SCHEME_KEY)).toBeNull()
    expect(localStorage.getItem(PACK_KEY)).toBeNull()
  })
})

describe("remembering a resolution", () => {
  it("keeps both halves, or the next frame has half an answer", () => {
    rememberResolution("dark", "dracula")

    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark")
    expect(localStorage.getItem(PACK_KEY)).toBe("dracula")
  })
})
