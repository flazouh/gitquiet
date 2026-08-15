import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { held, standAScreen } from "./screen"
import { BAR_ID } from "../ui/barSlot"
import type { Place } from "../ui/place"
import { TheBar } from "../ui/TheBar"

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
 * Waits for a word to arrive somewhere, up to a second.
 *
 * For the arrival that takes several turns of its own rather than one: a body, then the
 * region in it, then the wait for that region, then the draw. Counting the turns out in
 * the test would be writing down what the shell does today.
 */
const drawn = async (where: string, said: string): Promise<void> => {
  for (let turn = 0; turn < 50; turn++) {
    if (document.querySelector(where)?.textContent?.includes(said) === true) return
    await settled()
  }
}

/**
 * Waits for something about the page to become true, up to a second.
 *
 * `drawn` for a fact rather than for a word. `settled` waits twenty milliseconds, which
 * is a guess at how long React takes to come down and not a measurement of it: the guess
 * held until fourteen dependency updates shifted the timing under it, and then the
 * assertion after it read a tree that was still on its way out. Nothing here waits the
 * full second unless the thing never happens, which is the case worth failing on.
 *
 * For a change rather than for a state. Waiting for something to be false returns at once
 * where it was already false, which asserts what was true before the test began. Two of
 * the tests below watch for a thing arriving late, so they keep `settled` and say why.
 */
const until = async (that: () => boolean): Promise<void> => {
  for (let turn = 0; turn < 50; turn++) {
    if (that()) return
    await settled()
  }
}

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
    await drawn("#region", "ours")

    expect(document.querySelector("#region")?.textContent).toContain("ours")
    expect(document.documentElement.getAttribute("data-gitquiet-shown")).toBe("test-screen")
    page.close()
  })

  test("gives the page back when the screen closes", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()

    const page = standAScreen({ place: MINE, draw: () => <p>ours</p> })
    await drawn("#region", "ours")
    page.close()
    await until(() => document.getElementById("gitquiet-root") === null)

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
    await drawn("#region", "ours")
    page.close()
    await until(() => !held)

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
    await drawn("#region", "first")
    document.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }))
    await drawn("#region", "second")

    expect(document.querySelector("#region")?.textContent).toContain("second")
    page.close()
  })

  test("draws once the document has a body, having been started before it had one", async () => {
    /*
     * The shell runs at `document_start`, so on a cold load the screen is stood up
     * against a document that is still `<html>` and nothing else. Every element of
     * ours that lives outside the root — the bar's slot, the toaster, the hover
     * cards — is put into `body`, from a render, so drawing then threw inside the
     * first render and the tree was never built. The reader got an empty interface
     * and no second attempt, on about one load in eight.
     */
    history.replaceState(null, "", "/mine")
    const body = document.body
    document.documentElement.removeChild(body)

    const page = standAScreen({ place: MINE, draw: () => <p>ours</p> })
    // React renders on a task of its own, and on the reader's machine that task is the
    // one that ran against the bodyless document. Waiting here is what puts this test in
    // that order rather than in the one where the parser happens to win.
    await settled()

    document.documentElement.appendChild(body)
    theirPage()
    await drawn("#region", "ours")

    expect(document.querySelector("#region")?.textContent).toContain("ours")
    expect(mounted(page.container)).toBe(true)
    page.close()
  })

  test("draws one bar where the reader came back to a screen still on the page", async () => {
    /*
     * Measured on the page: /pulls, a pull request, Back, Back, and the one bar slot held
     * three bars. Coming back to a screen that never left takes the same container up
     * again — `interfaceContainer` hands it back by design — and a second root was made on
     * it every time. Every root's `ours` is that one container, so `oursToDraw` was true
     * for all of them and each drew its own bar. One press of ⌘K then opened three
     * palettes, and Escape shut one.
     */
    history.replaceState(null, "", "/mine")
    theirPage()

    const first = standAScreen({ place: MINE, draw: () => <TheBar where={{ kind: "home" }} /> })
    await drawn(`#${BAR_ID}`, "Search")

    const again = standAScreen({ place: MINE, draw: () => <TheBar where={{ kind: "home" }} /> })
    // Twenty milliseconds rather than a condition, because the fault is a second header
    // and there is no arrival to wait for. `until` counting to one would return on the
    // header the first screen already drew, before the second had a turn to draw another.
    await settled()

    expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(1)
    first.close()
    again.close()
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
    // The same, for the same reason. Nothing here ever stood up, so waiting for the root
    // to be absent returns on the first turn and asserts what was true before the test
    // began. What is watched for is a tree arriving after the address moved.
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
    await until(() => !mounted(page.container))

    expect(held).toBe(false)
    expect(mounted(page.container)).toBe(false)
  })
})

describe("a read already running by the time the screen asks for it", () => {
  test("says again what it reported before anybody was listening", async () => {
    /*
     * The fault this guards, measured on a live profile: page one of a person's
     * repositories is in the document GitHub served, so the read reports thirty rows
     * 673ms after the press — and React subscribes a frame later, so nobody heard it.
     * The rows went on the screen when the walk behind them ended, 3.9 seconds in.
     */
    const reading = (partly: (value: string) => void) =>
      Effect.gen(function* () {
        partly("page one")
        yield* Effect.sleep(20)
        return "the whole list"
      })

    const load = held(reading)

    const stages: Array<string> = []
    const whole = await Effect.runPromise(load((value) => stages.push(value)))

    expect(stages).toEqual(["page one"])
    expect(whole).toBe("the whole list")
  })

  test("reports the stages of a later read as they come, having replayed nothing", async () => {
    const reading = (partly: (value: string) => void) =>
      Effect.sync(() => {
        partly("first")
        return "last"
      })

    const load = held(reading)
    await Effect.runPromise(load(() => {}))

    const again: Array<string> = []
    expect(await Effect.runPromise(load((value) => again.push(value)))).toBe("last")
    expect(again).toEqual(["first"])
  })
})
