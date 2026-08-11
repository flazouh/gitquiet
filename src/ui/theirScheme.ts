import type { Scheme } from "../domain/theme"

/**
 * Which scheme GitHub itself is showing.
 *
 * "System" cannot mean the operating system here. A reader who chose GitHub's dark theme on a
 * light desktop was reading a black page with our interface painted white in the middle of it,
 * which is the same bug as no theme at all: their choice is on the page, in an attribute, and it
 * is the one that matters because ours stands inside theirs.
 *
 * `data-color-mode` is `light`, `dark` or `auto`, and only in the third case does the machine get
 * a say — which is what GitHub does with it too, so a reader who switches desktop appearance sees
 * both change together.
 */
export const schemeOnPage = (html: HTMLElement, prefersDark: boolean): Scheme => {
  const mode = html.getAttribute("data-color-mode")
  if (mode === "light") return "light"
  if (mode === "dark") return "dark"
  return prefersDark ? "dark" : "light"
}
