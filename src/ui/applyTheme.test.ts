import { afterEach, describe, expect, it } from "bun:test"
import { paintTheme, SCHEME_KEY } from "./applyTheme"

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

describe("painting a theme onto a root", () => {
  it("sets the pack's canvas and remembers the appearance", () => {
    const root = document.createElement("div")
    document.body.append(root)

    paintTheme(root, "dark", "gitquiet", false)

    expect(root.style.getPropertyValue("--color-canvas")).toBe("#171717")
    expect(root.style.getPropertyValue("--control")).toBe("#ffffff0f")
    expect(root.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem(SCHEME_KEY)).toBe("dark")
  })

  it("follows the OS when appearance is system", () => {
    const root = document.createElement("div")
    document.body.append(root)

    paintTheme(root, "system", "anthropic", true)

    expect(root.style.getPropertyValue("--color-canvas")).toBe("#1a1814")
    expect(localStorage.getItem(SCHEME_KEY)).toBe("system")
  })
})
