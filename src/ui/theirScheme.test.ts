import { describe, expect, test } from "bun:test"
import { schemeOnPage } from "./theirScheme"

const page = (attributes: Record<string, string>): HTMLElement => {
  const html = document.createElement("html")
  for (const [name, value] of Object.entries(attributes)) html.setAttribute(name, value)
  return html
}

describe("which scheme GitHub is showing", () => {
  test("takes their light, however the machine is set", () => {
    expect(schemeOnPage(page({ "data-color-mode": "light" }), true)).toBe("light")
  })

  test("takes their dark, however the machine is set", () => {
    // The complaint this exists for: a reader on GitHub's dark theme with a light desktop had
    // our whole interface paint white on their black page.
    expect(schemeOnPage(page({ "data-color-mode": "dark" }), false)).toBe("dark")
  })

  test("falls to the machine only where they are following it too", () => {
    expect(schemeOnPage(page({ "data-color-mode": "auto" }), true)).toBe("dark")
    expect(schemeOnPage(page({ "data-color-mode": "auto" }), false)).toBe("light")
  })

  test("falls to the machine on a page that says nothing, which is not github.com", () => {
    expect(schemeOnPage(page({}), true)).toBe("dark")
  })

  test("reads a mode it has never heard of as no answer at all", () => {
    expect(schemeOnPage(page({ "data-color-mode": "sepia" }), true)).toBe("dark")
  })
})
