import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { useDrawnAt } from "./drawnAt"

afterEach(cleanup)

const AT = "data-gitquiet-at"
const drawn = () => document.documentElement.getAttribute(AT)

const Screen = ({ at }: { readonly at: string | null }) => {
  useDrawnAt(at)
  return null
}

afterEach(() => document.documentElement.removeAttribute(AT))

describe("which address the screen has the page for", () => {
  test("says it once the read is ready", () => {
    render(<Screen at="/o/r/pull/1999" />)

    expect(drawn()).toBe("/o/r/pull/1999")
  })

  test("says nothing while the screen is still reading", () => {
    render(<Screen at={null} />)

    expect(drawn()).toBeNull()
  })

  test("takes it back when the read stops being ready", () => {
    const showing = render(<Screen at="/o/r/pull/1999" />)

    showing.rerender(<Screen at={null} />)

    expect(drawn()).toBeNull()
  })

  test("moves to the new address when the same screen draws another page", () => {
    const showing = render(<Screen at="/o/r/pull/1999" />)

    showing.rerender(<Screen at="/o/r/pull/2002" />)

    expect(drawn()).toBe("/o/r/pull/2002")
  })

  test("takes it back on the way off the page", () => {
    render(<Screen at="/o/r/pull/1999" />).unmount()

    expect(drawn()).toBeNull()
  })

  /*
   * Two screens are on the page at every navigation, on purpose: the one arriving
   * stands on the surface of the one leaving, and the one leaving goes last. A
   * screen that cleared the mark on the way out regardless would wipe the arriving
   * screen's claim a moment after it was made, and nothing would ever be seen to
   * arrive again for the rest of the document. Which is exactly what a single slot
   * did to the toasts. See `theScreenLeft`.
   */
  /*
   * The arrangement a place with two containers produces, which is the only way two
   * screens are ever mounted for one address at once. Both publish the same path, so
   * nothing about the path itself tells the stray one from the one on the page.
   */
  test("a stray copy leaving does not take down the address the screen on the page has", () => {
    const stray = render(<Screen at="/o/r/pull/1999" />)
    render(<Screen at="/o/r/pull/1999" />)

    stray.unmount()

    expect(drawn()).toBe("/o/r/pull/1999")
  })

  test("a screen leaving does not take down the address the next one just published", () => {
    const leaving = render(<Screen at="/o/r/pull/1999" />)
    render(<Screen at="/o/r/pull/2002" />)

    leaving.unmount()

    expect(drawn()).toBe("/o/r/pull/2002")
  })
})
