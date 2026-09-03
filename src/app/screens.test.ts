import { afterEach, describe, expect, test } from "bun:test"
import { fileOf, isWanted, preloadScreen, startScreenOnce, WANTED } from "./screens"

const beforeBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser")

afterEach(() => {
  if (beforeBrowser === undefined) Reflect.deleteProperty(globalThis, "browser")
  else Object.defineProperty(globalThis, "browser", beforeBrowser)
})

describe("naming the screen a page wants", () => {
  test("knows the twenty-one pages this extension has a screen for", () => {
    expect([...WANTED]).toEqual([
      "pull-request",
      "commit",
      "commits",
      "working-set",
      "repo-pulls",
      "repo-home",
      "issue",
      "repo-issues",
      "raise",
      "issues",
      "blame",
      "run",
      "actions",
      "releases",
      "discussions",
      "discussion",
      "notifications",
      "person-repos",
      "profile",
      "compare",
      "sign-on"
    ])
  })

  test("does not recognise a page it has no screen for", () => {
    // The name chooses a file to import, so it is checked rather than trusted.
    expect(isWanted("subscriptions")).toBe(false)
    expect(isWanted("")).toBe(false)
  })

  test("asks for each screen where the manifest publishes it", () => {
    // Built by scripts/build-screens.ts into `public/screens`, which WXT copies
    // verbatim and the manifest exposes. A path wrong here is a page that stays on
    // GitHub's own version of itself.
    expect(fileOf("working-set").script).toBe("/screens/working-set.js")
    expect(fileOf("pull-request").script).toBe("/screens/pull-request.js")
  })

  test("dresses every screen from the one sheet they share", () => {
    /*
     * One stylesheet for four screens, because every one of them imports the same
     * `styles.css` and the build emits it once. It matters that this is the same path
     * for all of them: the second screen a reader opens finds the sheet already on the
     * page and waits for nothing.
     */
    const sheets = new Set([...WANTED].map((what) => fileOf(what).styles))

    expect([...sheets]).toEqual(["/screens/styles.css"])
  })

  test("preloads one screen module once without starting it", () => {
    Object.defineProperty(globalThis, "browser", {
      configurable: true,
      value: { runtime: { getURL: (path: string) => `chrome-extension://test${path}` } }
    })

    expect(preloadScreen("pull-request")).toBe(true)
    expect(preloadScreen("pull-request")).toBe(false)

    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="modulepreload"][href$="/screens/pull-request.js"]'
    )
    expect(link).not.toBeNull()
    link?.remove()
  })

  test("starts one screen kind once when prepare and navigation both ask", () => {
    const started = new Set<typeof WANTED[number]>()
    let starts = 0
    const screen = { start: () => (starts += 1) }

    expect(startScreenOnce(started, "pull-request", screen)).toBe(true)
    expect(startScreenOnce(started, "pull-request", screen)).toBe(false)
    expect(starts).toBe(1)
  })
})
