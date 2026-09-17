import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { OUTSIDE, ROOT_ID, rootIn } from "./mount"
import { outsideHost } from "./outside"
import { theHost } from "./theHost"
import { keepRefraction } from "./refraction"

/**
 * What moving into a shadow root put out of reach, and keeps out of reach.
 *
 * The migration moved the whole interface under `#gitquiet-host`'s shadow root.
 * Three kinds of thing carried on addressing it as though it were still a child
 * of `body`, and every one of them failed silently — no error, no warning, a
 * lookup that answered null or a rule that matched nothing:
 *
 * - `document.getElementById("gitquiet-root")` returns null now. Radix reads a
 *   null portal `container` as "put it in `body`", so every dropdown in the
 *   interface rendered into their document, where the gate rule hid it. The
 *   reader saw a menu that would not open. The answer is the host every other
 *   overlay already used — see below; the root was never the right target for a
 *   thing that has to escape whatever clips it.
 * - A selector led by `html` matches nothing inside a shadow tree, because a
 *   shadow tree has no document element. That was the whole weight of the margin
 *   reset, so every paragraph and heading in the interface wore the browser's
 *   default margin.
 * - The gate rule hides every child of `body` without the outside mark, and one
 *   of the things it was hiding was ours: the SVG filter the bar's glass is made
 *   of, defined in a subtree Chrome then declined to run.
 *
 * Each of those was one line. None of them could fail a test that only renders
 * components, because each one is a lookup that answers politely and wrongly. So
 * the class is tested rather than the three instances.
 */
const uiDir = new URL(".", import.meta.url).pathname
const sourcesIn = (dir: string, ext: string): ReadonlyArray<[string, string]> =>
  readdirSync(dir)
    .filter((name) => name.endsWith(ext) && !name.includes(".test."))
    .map((name) => [name, readFileSync(join(dir, name), "utf8")] as [string, string])

describe("nothing looks for our own elements in their document", () => {
  test("no source asks `document` for the root", () => {
    // The lookup that broke every dropdown. `rootIn` asks the shadow root first
    // and their document after, which is the only way that answers on both.
    const guilty = [...sourcesIn(uiDir, ".ts"), ...sourcesIn(uiDir, ".tsx")]
      // `mount.ts` defines the helper. `motion.ts` reads the stylesheet's clock
      // through `document` deliberately, because the test seam that writes those
      // durations plants its root there — see the comment on `millisOf`, and the
      // two CI runs it cost to establish that the two halves have to agree.
      .filter(([name]) => name !== "mount.ts" && name !== "motion.ts")
      .filter(([, text]) =>
        /document\.getElementById\(\s*(ROOT_ID|["'`]gitquiet-root)/.test(text) ||
        /document\.querySelector\w*\(\s*["'`]#gitquiet-root/.test(text)
      )
      .map(([name]) => name)

    expect(guilty).toEqual([])
  })

  test("and `rootIn` finds it through the shadow boundary", () => {
    // The positive half: the helper the rule above points at has to actually
    // answer where `document` cannot, or the rule is just a ban.
    const page = document.implementation.createHTMLDocument("github")
    const { shadow } = theHost(page)
    const root = page.createElement("div")
    root.id = ROOT_ID
    shadow.append(root)

    // The lookup the components used to make, against the tree they now stand in.
    expect(page.getElementById(ROOT_ID)).toBeNull()
    expect(rootIn(page)).toBe(root)
  })
})

describe("no rule reaches our root from the document element", () => {
  test("nothing keyed on `html` or `body` styles anything inside the shadow root", () => {
    /*
     * `html` and `body` are the document's elements. A shadow tree has neither,
     * so a rule led by one of them is a rule that matches nothing in here — and
     * it fails by doing nothing at all, which is the hardest kind of failure to
     * notice. The rules that legitimately key on `html` are the gates and the
     * widths, and every one of those styles GitHub's page or our furniture out
     * in it, never the interface.
     */
    const guilty: string[] = []
    for (const [name, text] of sourcesIn(uiDir, ".css")) {
      // Every prelude in the file: the run of characters before an opening brace
      // that is not itself a brace, which is a selector list or an at-rule.
      for (const found of text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)) {
        const selector = (found[1] ?? "").trim()
        if (selector.startsWith("@")) continue
        if (!selector.includes(`#${ROOT_ID}`)) continue
        // A selector list, because one rule may carry several.
        for (const one of selector.split(",")) {
          if (/^(html|body)\b/.test(one.trim()) && one.includes(`#${ROOT_ID}`)) {
            guilty.push(`${name}: ${one.trim().replace(/\s+/g, " ")}`)
          }
        }
      }
    }

    expect(guilty).toEqual([])
  })
})

describe("the root is sized the way everything inside it is", () => {
  test("the root itself carries border-box, not only its descendants", () => {
    /*
     * `#gitquiet-root *` is every descendant and not the element. The root kept
     * the browser's `content-box`, and the root is the one element here carrying
     * both `width: 100%` and a horizontal padding — so the padding was added to
     * the width instead of taken out of it and the interface laid itself out
     * sixty-four pixels wider than the window. A horizontal scrollbar under the
     * page and the code column running off the right edge. Measured with the
     * built extension on a pull request: a root of 1488px in a viewport of 1440.
     *
     * It could not happen while the root stood in GitHub's document, because
     * their stylesheet resets `box-sizing` on everything and that reached the
     * root along with the rest. Inside a shadow root it reaches nothing.
     */
    const primer = readFileSync(join(uiDir, "primer.css"), "utf8")
    const at = primer.indexOf("box-sizing: border-box")
    const selector = primer.slice(primer.lastIndexOf("}", at) + 1, primer.indexOf("{", at))

    expect(selector).toContain(`#${ROOT_ID},`)
  })
})

describe("every overlay goes to the one host built for overlays", () => {
  test("no menu portals into the screen root", () => {
    /*
     * The hover cards, the settings dialog and the toasts all portal to
     * `outsideHost(document, OVER_ID)`: a child of `body` that carries the
     * outside mark, so the gate rule spares it, and the theme tokens, so it is
     * painted. The dropdown menus were the only overlays not using it — they
     * named `#gitquiet-root` instead, which was a child of `body` too until the
     * interface moved into a shadow root and the lookup started answering null.
     *
     * Radix then put them in `body` unmarked, where the gate rule hid them. A
     * menu that opens and cannot be seen.
     *
     * The root is the wrong target regardless: an overlay exists to escape
     * whatever its row is clipped by, which is the one thing standing inside the
     * root cannot do.
     */
    const guilty = [...sourcesIn(uiDir, ".tsx")]
      .filter(([, text]) => /container=\{[^}]*\bROOT_ID\b|container=\{[^}]*\brootIn\(/.test(text))
      .map(([name]) => name)

    expect(guilty).toEqual([])
  })

  test("and the host they do use is one their page cannot hide", () => {
    const page = document.implementation.createHTMLDocument("github")
    const host = outsideHost(page, "gitquiet-over")

    expect(host.parentElement).toBe(page.body)
    expect(host.hasAttribute(OUTSIDE)).toBe(true)
  })
})

describe("nothing of ours inherits from a page we have undressed", () => {
  test("our furniture in their document declares its own typography", () => {
    /*
     * The bar and the hover cards stand in `body`, and used to take their font
     * from whatever GitHub's stylesheet put there. Then we started turning their
     * stylesheets off for the recalculation saving, and `body` was left with no
     * font at all: the bar came out in Times New Roman at sixteen pixels beside
     * an interface set in Inter at fourteen, which is also why its padding read
     * as wrong — every row in it a seventh taller than it was drawn to be.
     *
     * Whatever the root declares for itself, the furniture outside it has to
     * declare too. There is nothing left to inherit from.
     */
    const primer = readFileSync(join(uiDir, "primer.css"), "utf8")
    const declaredFor = (selector: string): ReadonlyArray<string> => {
      const at = primer.indexOf(`\n${selector} {`)
      if (at === -1) return []
      const block = primer.slice(at, primer.indexOf("}", at))
      return ["font-family", "font-size", "color"].filter((one) => block.includes(`${one}:`))
    }

    expect(declaredFor("#gitquiet-root")).not.toEqual([])
    expect(declaredFor(":where([data-gitquiet-outside])")).toEqual(declaredFor("#gitquiet-root"))
  })
})

describe("everything of ours in their document is marked as ours", () => {
  test("the glass filter is spared by the gate rule", () => {
    /*
     * It was not, and the file that puts it there says in its own comment why
     * that is fatal: Chrome drops a `backdrop-filter` whose filter it cannot
     * resolve, and a filter inside a `display: none` subtree is one it declines
     * to run. The bar had no backdrop in production and nothing failed.
     */
    const page = document.implementation.createHTMLDocument("github")
    keepRefraction(page)

    const host = page.getElementById("gitquiet-glass")
    expect(host).not.toBeNull()
    expect(host?.hasAttribute(OUTSIDE)).toBe(true)
  })

  test("and so is everything else we put straight into body", () => {
    // The general form. Anything appended to their `body` is subject to the gate
    // rule, so the mark is not a detail of one host — it is the condition of
    // being allowed to live there at all.
    const page = document.implementation.createHTMLDocument("github")
    keepRefraction(page)
    outsideHost(page, "gitquiet-over")

    const unmarked = [...page.body.children]
      .filter((el) => el.id !== "gitquiet-host")
      .filter((el) => !el.hasAttribute(OUTSIDE))
      .map((el) => el.id || el.tagName)

    expect(unmarked).toEqual([])
  })
})
