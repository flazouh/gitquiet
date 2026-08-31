import { afterEach, describe, expect, test } from "bun:test"
import { standAScreen } from "./screen"
import { hasPreparedScreen } from "../ui/mount"
import {
  clearPreparedTraversal,
  markPreparedTraversal,
  OWNED_TRAVERSAL,
  preparedTraversal
} from "../ui/preparedNavigation"
import type { Place } from "../ui/place"

/**
 * The navigation seams under pressure rather than under one polite gesture.
 *
 * `screen.test.tsx` holds one test per behaviour; these hold the sequences a
 * real hand produces — Back and Forward mashed, a trail walked past the cache's
 * depth, the same traversal delivered twice — and assert the page ends whole:
 * one root, the right words on it, nothing thrown on the way.
 */

const MINE: Place = {
  name: "pressure-a",
  owns: (path) => path === "/mine",
  regions: ["#region"],
  fallback: "body",
  stages: ["#region"],
  bands: []
}

const OTHER: Place = {
  ...MINE,
  name: "pressure-b",
  owns: (path) => path === "/other"
}

/** One place holding many routes, as a repository's lists do. */
const WALKED: Place = {
  ...MINE,
  name: "pressure-walk",
  owns: (path) => path.startsWith("/walk/")
}

const theirPage = (): void => {
  document.body.innerHTML = `<main><div id="region">their page</div></main>`
}

const tidy = (): void => {
  const screens = (
    window as Window & {
      gitquietScreens?: Map<string, { prepared?: { dispose: () => void } }>
    }
  ).gitquietScreens
  for (const screen of screens?.values() ?? []) screen.prepared?.dispose()
  screens?.clear()
  clearPreparedTraversal(document)
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

const settled = (): Promise<void> => new Promise((done) => setTimeout(() => done(), 20))

const drawn = async (where: string, said: string): Promise<void> => {
  for (let turn = 0; turn < 50; turn++) {
    if (document.querySelector(where)?.textContent?.includes(said) === true) return
    await settled()
  }
}

afterEach(tidy)

describe("navigation under a heavy hand", () => {
  test("survives Back and Forward mashed between two screens", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()

    const first = standAScreen({
      place: MINE,
      route: "/mine",
      draw: () => <p>screen A</p>
    })
    await drawn("#region", "screen A")

    history.pushState(null, "", "/other")
    const second = standAScreen({
      place: OTHER,
      route: "/other",
      draw: () => <p>screen B</p>
    })
    await drawn("#region", "screen B")

    // Six traversals, no politeness between them: each dispatch is the shell
    // resuming the cached tree, exactly as a mashed Back/Forward delivers them.
    for (const [route, said] of [
      ["/mine", "screen A"],
      ["/other", "screen B"],
      ["/mine", "screen A"],
      ["/other", "screen B"],
      ["/mine", "screen A"],
      ["/other", "screen B"]
    ] as const) {
      document.dispatchEvent(new CustomEvent(OWNED_TRAVERSAL, { detail: route }))
      history.replaceState(null, "", route)
      await drawn("#region", said)
      expect(document.getElementById("gitquiet-root")?.textContent).toContain(said)
    }

    // One root on the page, not a pile of the hops it took to get here.
    expect(document.querySelectorAll("#gitquiet-root")).toHaveLength(1)

    second.close()
    first.close()
  })

  test("delivers the same traversal twice without standing anything twice", async () => {
    history.replaceState(null, "", "/mine")
    theirPage()

    const first = standAScreen({
      place: MINE,
      route: "/mine",
      draw: () => <p>screen A</p>
    })
    await drawn("#region", "screen A")

    history.pushState(null, "", "/other")
    const second = standAScreen({
      place: OTHER,
      route: "/other",
      draw: () => <p>screen B</p>
    })
    await drawn("#region", "screen B")

    // The same traversal, twice in one task — an offered traversal and the
    // navigation event can both report one gesture. The first resumes; the
    // second finds the cache empty and must change nothing.
    document.dispatchEvent(new CustomEvent(OWNED_TRAVERSAL, { detail: "/mine" }))
    document.dispatchEvent(new CustomEvent(OWNED_TRAVERSAL, { detail: "/mine" }))
    history.replaceState(null, "", "/mine")
    await drawn("#region", "screen A")

    expect(document.querySelectorAll("#gitquiet-root")).toHaveLength(1)
    expect(document.getElementById("gitquiet-root")?.textContent).toContain("screen A")

    second.close()
    first.close()
  })

  test("walks past the cache's depth and comes back to a page it let go", async () => {
    theirPage()

    // Eleven pages of one place, which is three more than the cache holds.
    const standings = []
    for (let step = 1; step <= 11; step++) {
      history.replaceState(null, "", `/walk/${step}`)
      standings.push(
        standAScreen({
          place: WALKED,
          route: `/walk/${step}`,
          draw: () => <p>walked {step}</p>
        })
      )
      await drawn("#region", `walked ${step}`)
    }

    // The early pages fell off the end; the recent ones are still live.
    expect(hasPreparedScreen(document, "/walk/1", WALKED)).toBe(false)
    expect(hasPreparedScreen(document, "/walk/2", WALKED)).toBe(false)
    expect(hasPreparedScreen(document, "/walk/9", WALKED)).toBe(true)

    // Back to a page the cache let go: nothing resumes, and nothing breaks —
    // the page that was standing stays standing, which is what the shell's
    // hold-the-surface path draws the rebuild over.
    document.dispatchEvent(new CustomEvent(OWNED_TRAVERSAL, { detail: "/walk/1" }))
    await settled()

    expect(document.querySelectorAll("#gitquiet-root")).toHaveLength(1)
    expect(document.getElementById("gitquiet-root")?.textContent).toContain("walked 11")

    for (const standing of standings.reverse()) standing.close()
  })

  test("holds eight armed routes under an arming storm, newest last", () => {
    for (let route = 1; route <= 20; route++) {
      markPreparedTraversal(document, `/storm/${route}`)
    }
    // Re-arming one already held moves it to the end rather than doubling it.
    markPreparedTraversal(document, "/storm/15")

    const marker = document.querySelector('meta[name="data-gitquiet-prepared-traversal-route"]')
    const armed = marker?.getAttribute("content")?.split(" ") ?? []

    expect(armed).toHaveLength(8)
    expect(armed).toEqual([
      "/storm/13",
      "/storm/14",
      "/storm/16",
      "/storm/17",
      "/storm/18",
      "/storm/19",
      "/storm/20",
      "/storm/15"
    ])
    expect(preparedTraversal(document)).toBe("/storm/15")

    clearPreparedTraversal(document, "/storm/17")
    expect(preparedTraversal(document)).toBe("/storm/15")
    expect(
      document
        .querySelector('meta[name="data-gitquiet-prepared-traversal-route"]')
        ?.getAttribute("content")
        ?.split(" ")
    ).toHaveLength(7)
  })
})
