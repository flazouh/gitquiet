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
 *   reader saw a menu that would not open.
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
      .filter(([name]) => name !== "mount.ts")
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
