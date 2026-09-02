import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

/**
 * Every colour these two files paint with has to be a colour this codebase has.
 *
 * Written after `text-warn`, `border-warn`, `bg-accent` and `border-subtle` were all
 * shipped to a live page and all four did nothing. Tailwind emits no rule for a token
 * that does not exist and neither the compiler nor the linter has an opinion about it,
 * so the badge that was supposed to be a warning rendered as unstyled text and the
 * selected Label chip looked exactly like an unselected one. Nothing failed. It was
 * only visible in a screenshot.
 *
 * Scoped to the gist screens rather than to `src/ui` as a whole. A sweep of every
 * component would have to tell `text-xs` from `text-ink`, and the guard that tries is
 * the guard that gets an allowlist and then gets disabled. These two files are the ones
 * written against a palette their author had not read.
 */

/** The semantic families, as `styles.css` and its neighbours define them. */
const defined = (): ReadonlySet<string> => {
  const css = [...new Bun.Glob("src/ui/*.css").scanSync()]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")

  return new Set([...css.matchAll(/--color-([a-z-]+)/g)].map((found) => found[1] ?? ""))
}

/**
 * The colour-shaped classes, which is the hard half.
 *
 * `text-` prefixes a size as often as a colour — `text-xs`, `text-sm` — so the test
 * cannot simply demand that every suffix be a token. It goes the other way instead:
 * Tailwind's own words for these three prefixes are listed, and anything that is
 * neither one of those nor a defined token is a colour that does not exist.
 *
 * That direction is the whole point. The first version of this guard only checked
 * suffixes beginning with one of our family names, which meant `text-warn` and
 * `border-subtle` — the two that had actually shipped broken — were skipped as "not
 * ours" and the guard passed on the bug it was written for.
 */
const TAILWIND: ReadonlySet<string> = new Set([
  // Sizes and alignment that share the `text-` prefix.
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl",
  "left", "center", "right", "justify", "start", "end",
  "wrap", "nowrap", "balance", "pretty", "ellipsis", "clip",
  // Widths and styles that share the `border-` prefix.
  "0", "2", "4", "8", "t", "b", "l", "r", "x", "y", "solid", "dashed", "dotted", "none",
  // The universal colour words.
  "transparent", "current", "inherit", "white", "black"
])

const painted = (source: string): ReadonlyArray<string> =>
  [...source.matchAll(/\b(?:bg|text|border|fill|stroke|ring)-([a-z0-9][a-z0-9-]*)/g)]
    .map((found) => found[1] ?? "")
    .filter((suffix) => !TAILWIND.has(suffix))

describe("the gist screens paint with colours this codebase has", () => {
  const known = defined()

  for (const path of [
    "src/ui/GistListScreen.tsx",
    "src/ui/GistRowView.tsx",
    "src/ui/GistScreen.tsx"
  ]) {
    test(`${path} names no colour that does not exist`, () => {
      const unknown = [...new Set(painted(readFileSync(path, "utf8")))].filter(
        (suffix) => !known.has(suffix)
      )

      expect(unknown).toEqual([])
    })
  }

  test("the guard catches the four that actually shipped broken", () => {
    // Otherwise this passes forever by matching nothing, which is how a guard written
    // against a bug that already happened quietly stops guarding. All four of these
    // were on a live page and all four did nothing.
    const found = painted('className="bg-raised text-warn border-subtle bg-accent text-xs"')

    expect(found).toEqual(["raised", "warn", "subtle", "accent"])
    expect(found.filter((suffix) => !known.has(suffix))).toEqual([
      "warn",
      "subtle",
      "accent"
    ])
    expect(known.has("ink-muted")).toBe(true)
  })
})
