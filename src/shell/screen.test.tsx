import { afterEach, describe, expect, test } from "bun:test"
import { standAScreen } from "./screen"
import type { Place } from "../ui/place"

/**
 * A page of GitHub's, invented rather than copied: what is under test here is the
 * order a screen stands up in, which is the same order on every one of their pages.
 */
const MINE: Place = {
  name: "test-screen",
  owns: (path) => path === "/mine",
  regions: ["#region"],
  fallback: "body",
  stages: ["#region"],
  bands: []
}

const theirPage = (): void => {
  document.body.innerHTML = `<main><div id="region">their page</div></main>`
}

const tidy = (): void => {
  document.body.innerHTML = ""
  for (const name of [
    "data-gitquiet-taken",
    "data-gitquiet-shown",
    "data-gitquiet-revealed",
    "data-gitquiet-gating",
    "data-gitquiet-page"
  ])
    document.documentElement.removeAttribute(name)
}

/** React renders on a task of its own, so the page is read on the turn after. */
const settled = (): Promise<void> => new Promise((done) => setTimeout(() => done(), 20))

/**
 * Whether the screen's tree is still rendered, wherever its container happens to be.
 *
 * Asked of the container rather than of the page because the two answers differ in the
 * case that matters: a screen that never reached the page has a container nobody can
 * find, and a tree in it that is still drawing a bar into the page's one bar slot.
 */
const mounted = (container: Element): boolean => container.childNodes.length > 0

afterEach(tidy)

describe("standing a screen on the page", () => {
  test("draws into the page and takes the region", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()

    const page = standAScreen({ place: MINE, draw: () => <p>ours</p> })
    await settled()

    expect(document.querySelector("#region")?.textContent).toContain("ours")
    expect(document.documentElement.getAttribute("data-gitquiet-shown")).toBe("test-screen")
    page.close()
  })

  test("gives the page back when the screen closes", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()

    const page = standAScreen({ place: MINE, draw: () => <p>ours</p> })
    await settled()
    page.close()
    await settled()

    expect(document.getElementById("gitquiet-root")).toBeNull()
    expect(document.documentElement.hasAttribute("data-gitquiet-taken")).toBe(false)
  })

  test("lets go of whatever the screen was holding", async () => {
    // Presses answered on its behalf, flags the shell reads. A screen that leaves them
    // behind is a screen still answering for a page it is not on.
    history.replaceState(null, "", "/mine")
    theirPage()
    let held = true

    const page = standAScreen({
      place: MINE,
      draw: () => <p>ours</p>,
      holding: () => () => {
        held = false
      }
    })
    await settled()
    page.close()
    await settled()

    expect(held).toBe(false)
  })

  test("draws again when the screen asks, without leaving the page", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()
    let showing = "first"

    const page = standAScreen({
      place: MINE,
      draw: (standing) => (
        <button
          type="button"
          onClick={() => {
            showing = "second"
            standing.redraw()
          }}
        >
          {showing}
        </button>
      )
    })
    await settled()
    document.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }))
    await settled()

    expect(document.querySelector("#region")?.textContent).toContain("second")
    page.close()
  })

  test("stands nothing up when the reader leaves before the address arrives", async () => {
    /*
     * The case that put two bars on one page. A press starts the screen, the reader
     * presses something else before the address moves, and the first screen's wait
     * lands afterwards — onto a page that belongs to somebody else now. Every screen
     * has a bar, so the leftover tree drew a second one beside the real one.
     */
    history.replaceState(null, "", "/somewhere-else")
    theirPage()

    const page = standAScreen({ place: MINE, draw: () => <p>ours</p> })
    page.close()
    history.pushState(null, "", "/mine")
    await settled()

    expect(document.querySelector("#region")?.textContent).toBe("their page")
    expect(document.getElementById("gitquiet-root")).toBeNull()
  })

  test("comes down when the screen closes before it ever reached the page", async () => {
    /*
     * The rest of that case, found on the page rather than here: nothing stood up, and
     * the tree was still mounted. A screen renders into a container it is handed before
     * there is anywhere to put it, and its bar goes into the one bar slot on the page
     * from the first render — so a tree nobody took down keeps a bar on a page it never
     * reached. That is the second bar the reader kept seeing.
     */
    history.replaceState(null, "", "/somewhere-else")
    theirPage()
    let held = true

    const page = standAScreen({
      place: MINE,
      draw: () => <p>ours</p>,
      holding: () => () => {
        held = false
      }
    })
    await settled()
    page.close()
    await settled()

    expect(held).toBe(false)
    expect(mounted(page.container)).toBe(false)
  })
})
