import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act, cleanup, render } from "@testing-library/react"
import { chosenScheme, paintScheme, type Scheme, useScheme } from "./scheme"

/**
 * Which palette the window wears, and the two ways that used to go wrong.
 *
 * A reader who has said "light" on a dark desktop is the whole reason this file
 * exists. Before the choice existed there was one rule — follow the desktop — and
 * a listener in `index.html` enforcing it forever; the failure worth a test is not
 * that the menu shows three items but that choosing one of them survives the
 * desktop changing its mind underneath.
 */

/** The desktop's own answer, which a webview cannot be asked to change for real. */
const desktopIs = (dark: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: dark,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  })
}

const dark = (): boolean => document.documentElement.classList.contains("dark")

/** The menu, reduced to the one item this test presses. */
const Choosing = ({ asking }: { readonly asking: Scheme }) => {
  const { scheme, choose } = useScheme()

  return (
    <button type="button" onClick={() => choose(asking)}>
      {scheme}
    </button>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

afterEach(cleanup)

describe("what was chosen", () => {
  test("is the desktop's business until somebody says otherwise", () => {
    expect(chosenScheme()).toBe("system")
  })

  test("is read back from the last launch", () => {
    localStorage.setItem("gitquiet.scheme", "light")
    expect(chosenScheme()).toBe("light")
  })

  test("is not whatever happens to be in that key", () => {
    localStorage.setItem("gitquiet.scheme", "solarized")
    expect(chosenScheme()).toBe("system")
  })
})

describe("what the window paints", () => {
  test("follows the desktop while nothing has been chosen", () => {
    desktopIs(true)
    paintScheme("system")
    expect(dark()).toBe(true)

    desktopIs(false)
    paintScheme("system")
    expect(dark()).toBe(false)
  })

  test("overrules the desktop once something has been", () => {
    desktopIs(true)
    paintScheme("light")
    expect(dark()).toBe(false)

    desktopIs(false)
    paintScheme("dark")
    expect(dark()).toBe(true)
  })
})

describe("choosing", () => {
  test("paints at once and is still chosen at the next launch", () => {
    desktopIs(true)

    const { getByRole } = render(<Choosing asking="light" />)
    // Mounted on a dark desktop with nothing chosen, so this is the state the
    // reader is arguing with.
    expect(getByRole("button").textContent).toBe("system")
    expect(dark()).toBe(true)

    act(() => {
      getByRole("button").click()
    })

    expect(getByRole("button").textContent).toBe("light")
    expect(dark()).toBe(false)
    // Which is what the head script reads before the next window has painted
    // anything, and the reason a choice does not flash the other scheme first.
    expect(chosenScheme()).toBe("light")
  })
})
