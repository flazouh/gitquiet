/**
 * Whether a gist's own page says it is Secret, read off the header GitHub
 * already draws.
 *
 * `.Label` beside the gist's own name, its text and not its `title` — the
 * tooltip is the whole reason a reader misses this, and reading it would only
 * move the same silence one layer down. Structure and content together,
 * never a natural-language attribute alone: `selectorHygiene.test.ts` holds
 * `place.ts` to that rule and this reads the same way on purpose. See
 * `docs/spec/gists.md`.
 */
export const isSecretGist = (page: Document): boolean => {
  const header = page.querySelector(".gisthead")
  if (header === null) return false

  const labels = header.querySelectorAll(".Label")
  return [...labels].some((label) => label.textContent?.trim() === "Secret")
}
