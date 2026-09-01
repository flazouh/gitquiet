import { afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { cleanup, render } from "@testing-library/react"
import { Option } from "effect"
import { sittingsIn } from "../domain/sittings"
import type { InvolvedPullRequest, Shelf } from "../domain/workingSet"
import { ArtProvider, SETS, setOf, THE_ART } from "./art"
import { HUGEICONS } from "./hugeicons"
import { OCTICONS } from "./octicons"
import { WorkingSet } from "./WorkingSet"

/**
 * Which set a screen is drawn in, and whether the seam that decides holds.
 *
 * Two sets and a reader who can pick, with the default picking by place: GitHub's
 * own glyphs on their page, ours in a window of ours. Three things have to be true
 * for that to be one interface rather than two half-drawn ones, and this file is
 * those three. Every name is answered by both sets. The choice resolves the way
 * the knob says. And no screen reaches around the table for a glyph of its own —
 * the failure that rule prevents is a screen that keeps the old drawing on the day
 * the set changes, which fifteen screens were doing.
 */

afterEach(cleanup)

const involved = (over: Partial<InvolvedPullRequest> = {}): InvolvedPullRequest => ({
  reference: { owner: "flazouh", repo: "octo-repo", number: 1 },
  id: "1000",
  title: "a pull request",
  author: { login: "flazouh", isAutomated: false, faceUrl: Option.none() },
  state: "open",
  shelf: Option.some<Shelf>("needs-action"),
  why: Option.none(),
  readByViewer: true,
  comments: 0,
  labels: 0,
  assignees: 0,
  openedAt: "2026-07-01T00:00:00Z",
  changedAt: "2026-07-01T00:00:00Z",
  headSha: "sha1",
  channels: [],
  checks: Option.none(),
  reviewed: Option.none(),
  size: Option.none(),
  ...over
})

const aScreen = () => (
  <WorkingSet
    sittings={sittingsIn([involved({ comments: 3 })], () => Option.none())}
    onOpen={() => {}}
  />
)

describe("the icons a screen is drawn in", () => {
  test("are whichever set the place they are drawn in hands down", () => {
    // Octicons name themselves in the markup, which is what makes the question
    // answerable without reaching for a path.
    render(<ArtProvider here={OCTICONS}>{aScreen()}</ArtProvider>)
    expect(document.querySelector('[class*="octicon"]')).not.toBeNull()

    cleanup()

    render(<ArtProvider here={HUGEICONS}>{aScreen()}</ArtProvider>)
    expect(document.querySelector("svg")).not.toBeNull()
    expect(document.querySelector('[class*="octicon"]')).toBeNull()
  })

  test("fall back to ours where nothing above the screen has said", () => {
    render(aScreen())

    expect(document.querySelector("svg")).not.toBeNull()
    expect(document.querySelector('[class*="octicon"]')).toBeNull()
    expect(THE_ART).toBe(HUGEICONS)
  })

  test("answer every name in both sets, so no screen can ask for a glyph nobody draws", () => {
    // Drawn rather than counted. `typeof` says "object" for half of one set, both
    // packages wrapping their glyphs, so the only question worth asking of a name
    // is whether something comes out of it.
    for (const [set, table] of Object.entries(SETS)) {
      for (const [name, Drawing] of Object.entries(table)) {
        const { container } = render(<Drawing size={16} />)
        expect(container.querySelector("svg"), `${set} draws nothing for ${name}`).not.toBeNull()
        cleanup()
      }
    }
    // The same names in both, which is the thing the type states and the thing a
    // reader switching sets would notice first if it stopped being true.
    expect(Object.keys(OCTICONS).sort()).toEqual(Object.keys(HUGEICONS).sort())
  })

  test("draw the Command key as a key in both sets, which is whose key it is", () => {
    /*
     * Octicons has no glyph for it, and the nearest name — `CommandPaletteIcon` — is a
     * prompt and a caret. That is what the bar's badge wore on GitHub's page: `>_K`,
     * where a reader's hand is looking for `⌘K`. It named the thing the key opens.
     *
     * So this one is ours in their set, for the reason the GitHub mark is theirs in
     * ours: the shape belongs to the keyboard rather than to a drawing style. Asserted
     * by the name a screen reader would say, because the alternative is asserting a
     * path, and a path is what the next redraw changes.
     */
    for (const [set, table] of Object.entries(SETS)) {
      const { container } = render(<table.command size={16} />)
      const drawn = container.querySelector("svg")

      expect(drawn, `${set} draws nothing for the command key`).not.toBeNull()
      expect(drawn?.getAttribute("aria-label"), `${set} does not name it`).toBe("Command")
      cleanup()
    }
  })

  test("resolve the reader's answer against where they are", () => {
    expect(setOf("match", OCTICONS)).toBe(OCTICONS)
    expect(setOf("match", HUGEICONS)).toBe(HUGEICONS)
    // Asked for by name, the place stops mattering: a reader who wants GitHub's
    // glyphs in a window of ours gets them.
    expect(setOf("github", HUGEICONS)).toBe(OCTICONS)
    expect(setOf("gitquiet", OCTICONS)).toBe(HUGEICONS)
  })

  test("come from the two set modules, which is the whole of what a set means here", () => {
    const sets = ["src/ui/hugeicons.tsx", "src/ui/octicons.tsx"]
    const reaching = [...new Bun.Glob("src/**/*.{ts,tsx}").scanSync(".")].filter((path) => {
      if (sets.some((set) => path === set || path.endsWith(set))) return false
      if (path.endsWith("art.test.tsx")) return false
      return /from "@(primer\/octicons-react|hugeicons\/)/.test(readFileSync(path, "utf8"))
    })

    expect(reaching).toEqual([])
  })
})
