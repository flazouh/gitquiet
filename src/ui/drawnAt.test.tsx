import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render } from "@testing-library/react"
import { DrawnAt, useDrawnAt } from "./drawnAt"
import { ScreenActivityProvider } from "./screenActivity"
import { ROOT_ID } from "./mount"

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

/*
 * The reason {@link DrawnAt} is a component and not the hook called in each
 * screen. Until these, the line that asks was load-bearing and unasserted:
 * deleting `useScreenActivity` left every test in the repository green.
 */
describe("a screen that is mounted but does not have the page", () => {
  const inactive = (at: string | null) => (
    <ScreenActivityProvider active={false}>
      <DrawnAt path={at} />
    </ScreenActivityProvider>
  )
  const active = (at: string | null) => (
    <ScreenActivityProvider active>
      <DrawnAt path={at} />
    </ScreenActivityProvider>
  )

  test("claims nothing, however ready its own read is", () => {
    render(inactive("/o/r/pull/1999"))

    expect(drawn()).toBeNull()
  })

  test("gives up the claim when the page is taken from under it", () => {
    // A live history entry, kept mounted off the page: it drew this address and
    // then something else took the page. A mark left standing would hand the
    // page to a screen that is not on it.
    const showing = render(active("/o/r/pull/1999"))
    expect(drawn()).toBe("/o/r/pull/1999")

    showing.rerender(inactive("/o/r/pull/1999"))

    expect(drawn()).toBeNull()
  })

  test("claims again when the page comes back to it", () => {
    const showing = render(inactive("/o/r/pull/1999"))

    showing.rerender(active("/o/r/pull/1999"))

    expect(drawn()).toBe("/o/r/pull/1999")
  })
})

/*
 * The route the caches are keyed on, which a claim used to overwrite with its
 * own shorter answer. A claim is a pathname; a route is a pathname and a
 * search. See `markScreenRouteWhenWhole`.
 */
describe("what a claim says about the route", () => {
  const standing = (route: string): HTMLElement => {
    const root = document.createElement("div")
    root.id = ROOT_ID
    root.setAttribute("data-gitquiet-route", route)
    document.body.append(root)
    return root
  }
  const at = (path: string, search: string): void => {
    const view = document.defaultView as unknown as { location: { pathname: string; search: string } }
    view.location.pathname = path
    view.location.search = search
  }

  afterEach(() => {
    document.getElementById(ROOT_ID)?.remove()
    at("/", "")
  })

  test("leaves a filtered list's route alone, search and all", () => {
    const root = standing("/owner/repo/pulls?q=is%3Aopen")
    at("/owner/repo/pulls", "?q=is%3Aopen")

    render(<Screen at="/owner/repo/pulls" />)

    expect(drawn()).toBe("/owner/repo/pulls")
    expect(root.getAttribute("data-gitquiet-route")).toBe("/owner/repo/pulls?q=is%3Aopen")
  })

  test("moves the route where the claim is the whole address, as one pull request opening another", () => {
    const root = standing("/owner/repo/pull/12")
    at("/owner/repo/pull/13", "")

    render(<Screen at="/owner/repo/pull/13" />)

    expect(root.getAttribute("data-gitquiet-route")).toBe("/owner/repo/pull/13")
  })
})
