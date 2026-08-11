import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"

const widths = () => readFileSync("src/ui/widths.css", "utf8")

/**
 * The measures, which are the one part of this that follows the surface rather
 * than the address or the screen.
 */
describe("the measures GitHub's own layout would otherwise hold", () => {
  test("are keyed on the surface a screen of ours is standing on", () => {
    /*
     * Three answers were tried and only the third is right.
     *
     * `data-gitquiet-page` is the page the document is *about*, and a press moves it a
     * second before the address does — deliberately, because the rules that hold their
     * conversation back have to be the incoming page's rules from the instant of the
     * press. A measure keyed on it is lifted at that instant, while the list that was
     * measured is still the page.
     *
     * `data-gitquiet-shown` named the screen that took the region, which is right until
     * two screens share a surface — and they do, on every press this extension answers
     * itself. A pull request pressed on the Working Set stands where the list stood,
     * inside their dashboard, and the mark flips to `conversation` the moment it lands:
     * their 900-pixel column came back around the card, along with the
     * `main { display: none }` that holds their feed until a partial loads. Measured on
     * a live page: the card at 0 pixels, the reader looking at an empty panel.
     *
     * The surface is what the measure was ever about. `#gitquiet-root` is in exactly one
     * place at a time and it is the place that must not be narrowed, whichever of the
     * screens is drawing into it.
     */
    expect(widths()).not.toContain("data-gitquiet-page")
    expect(widths()).not.toContain("data-gitquiet-shown")
  })

  test("say so on every rule that answers one of GitHub's", () => {
    /*
     * Every selector here exists to outweigh a rule of theirs, and each has to name the
     * container for the reason above. A rule that forgets is a rule that speaks on a page
     * this extension left alone.
     *
     * The frame on the container itself is the exception and names it as the subject
     * instead, which is why the match is for the id rather than for `:has()`.
     */
    for (const [selector] of widths().matchAll(/^html\[[^{]+/gm)) {
      expect(selector).toContain("[data-gitquiet-taken]")
      expect(selector).toContain("#gitquiet-root")
    }
  })

  test("stand the interface in one frame, on every screen at once", () => {
    /*
     * Measured on seven screens before this rule existed: only a pull request had an inset,
     * and it was GitHub's own. A repository's home, its pull requests, its commits, its
     * issues and the dashboard all ran the first card flush to the window edge under a bar
     * floating in thirty-two pixels.
     *
     * The container is the one element every screen has, so the frame is one rule on it
     * rather than a number each screen remembers to repeat.
     */
    expect(widths()).toContain("html[data-gitquiet-taken] #gitquiet-root")
    expect(widths()).toContain("padding-inline: var(--gitquiet-gutter)")
  })

  test("leave the frame to the shell, no screen carrying one of its own", () => {
    /*
     * Two insets on one screen is forty-eight pixels on a wide window, measured on five of
     * them: the shell's thirty-two and the screen's own sixteen. Six screens chose that
     * sixteen separately — `WorkingSet`, the two issue lists, the history, a repository's
     * pull requests and its home — and `IssueScreen` kept a `GUTTER` constant for it.
     *
     * The two shapes are what an outer frame looks like here: a padding across beside a
     * padding down the page, on the element holding a whole screen. A card's own `p-4` is
     * not one of them and is left alone.
     */
    const bodies = ["WorkingSet", "History"]
    const screens = [...new Bun.Glob("src/ui/*Screen.tsx").scanSync()]

    for (const path of screens) expect(readFileSync(path, "utf8")).not.toContain("--gitquiet-gutter")

    for (const path of [...screens, ...bodies.map((one) => `src/ui/${one}.tsx`)]) {
      const written = readFileSync(path, "utf8")

      for (const shape of ["px-4 py-3", "px-4 pt-3", "px-4 pb-6"]) expect(written).not.toContain(shape)
    }
  })

  test("take GitHub's own inset off the one region that has one", () => {
    // Their thirty-two on a pull request is where this scale comes from, and it is a frame
    // only that region has. Ours is on the container, so theirs would be counted twice.
    const rule = widths().slice(widths().indexOf("#diff-comparison-viewer-container:has"))

    expect(rule.slice(0, rule.indexOf("}"))).toContain("padding-inline: 0")
  })
})
