import { describe, expect, test } from "bun:test"
import { opensInside } from "./opensInside"

describe("opensInside", () => {
  test("a plain click on a commit URL stays in the app", () => {
    expect(
      opensInside("https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1", {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0
      })
    ).toBe(true)
  })

  test("Cmd-click on a commit URL goes outside", () => {
    expect(
      opensInside("https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1", {
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0
      })
    ).toBe(false)
  })

  test("the GitHub link on the card still goes outside", () => {
    expect(
      opensInside("https://github.com/actions/checkout/pull/2454", {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0
      })
    ).toBe(false)
  })

  test("unrelated hosts always go outside", () => {
    expect(
      opensInside("https://example.com/commit/abc", {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0
      })
    ).toBe(false)
  })
})
