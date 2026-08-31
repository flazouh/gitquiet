import { describe, expect, test } from "bun:test"
import { PLACES } from "./place"

/**
 * A guard on the one kind of hook that breaks without a deploy behind it.
 *
 * `aria-label`, `title`, `placeholder` and `alt` are English written for a person, and
 * GitHub rewords them and translates them without touching a line of markup structure.
 * A gate that leans on one of them alone is a gate that a copy edit or a French reader
 * turns off — which is exactly how the Account band went quiet. A structural anchor beside
 * it (an id, a class, a `:has()`, a `data-*`, a custom element) is what the label is proved
 * against, and what still holds when the words move.
 *
 * This does not forbid a natural-language attribute. It forbids one standing on its own,
 * and it records every place one is used on purpose, so a new fragile selector fails here
 * until somebody has looked at it rather than slipping in unseen.
 */

const NATURAL = ["aria-label", "aria-description", "title", "placeholder", "alt"]

/** What proves an element by its shape rather than its wording. */
const anchored = (selector: string): boolean => {
  if (selector.includes(":has(")) return true
  if (/\[(data-|role=)/.test(selector)) return true
  if (/\b(app-name|partial-name)/.test(selector)) return true
  // Drop every attribute group first: `aria-label`'s own hyphen must not read as a
  // custom element, and its value's words must not read as classes.
  const bare = selector.replace(/\[[^\]]*\]/g, "")
  return /[#.]/.test(bare) || /\b[a-z]+-[a-z]+\b/.test(bare) // id or class, or react-app/turbo-frame
}

const usesNaturalAttr = (selector: string): boolean =>
  NATURAL.some((name) => selector.includes(`[${name}`))

/** Every selector a place hands to the gates or the search, in one flat list. */
const selectorsOf = PLACES.flatMap((place) => [
  ...place.regions,
  ...(place.stages ?? []),
  ...place.bands,
  place.fallback,
  ...(place.loadedWhen === undefined ? [] : [place.loadedWhen])
])

/**
 * The selectors that name a natural-language attribute and nothing structural, each with
 * the reason it is allowed to. A new one is a test failure until it is added here with a
 * note that says why GitHub gives nothing steadier to hold.
 */
const ACKNOWLEDGED: ReadonlyMap<string, string> = new Map([
  [
    '[aria-label="Pull request navigation tabs"]',
    "Their Conversation/Commits/Checks/Files row carries no id or stable class; the tab " +
      "strip is named only by this label, and the band is already scoped to the pull " +
      "request page by the marker the gate is generated under."
  ]
])

describe("no gate leans on a reworded label alone", () => {
  test("every natural-language selector is anchored or acknowledged", () => {
    const fragile = selectorsOf.filter(
      (selector) =>
        usesNaturalAttr(selector) && !anchored(selector) && !ACKNOWLEDGED.has(selector)
    )

    expect(fragile).toEqual([])
  })

  test("nothing acknowledged has quietly gained an anchor or lost its label", () => {
    // Keeps the list honest: an entry that no longer describes a live fragile selector is
    // dead weight that hides the next real one.
    const stale = [...ACKNOWLEDGED.keys()].filter(
      (selector) =>
        !selectorsOf.includes(selector) || anchored(selector) || !usesNaturalAttr(selector)
    )

    expect(stale).toEqual([])
  })
})
