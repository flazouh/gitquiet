import { Effect } from "effect"
import { reportError } from "../observability/sentry"
import { ROOT_ID } from "./mount"
import type { Place } from "./place"

/**
 * Whether the takeover actually took, checked against the page after the fact.
 *
 * Every rule that keeps GitHub's own page off the screen is a selector written from
 * the table in `place.ts`, and every one of them names markup this extension does not
 * own. GitHub renames it without warning: a band pinned to `aria-label="Account"` went
 * on matching nothing the day they reworded that label to "Dashboard menu", the gate
 * hid nothing, and their repository list stood beside ours until a reader saw it and
 * said so. The selector was wrong for days and nothing in the code knew.
 *
 * This is what knows. After a screen has taken the page, it asks the one question the
 * gate cannot ask itself — is any of their page still showing where ours was meant to
 * stand — and reports the answer rather than waiting for an eye to catch it. The rules
 * stay the way they are; this only makes their failure loud.
 */

/** The human-worded attributes: reworded by copy changes and translated per locale. */
const NATURAL_ATTRS = ["aria-label", "aria-description", "title", "placeholder", "alt"]

/**
 * Removes every `:pseudo(...)` group with a balanced-parenthesis body from a selector.
 *
 * `:has(#dashboard.dashboard)` and `:not(#gitquiet-root)` are the two that appear, and a
 * plain regex cannot take them out: a `:has()` body can hold its own parentheses. So the
 * depth is counted, and the characters inside the outermost pair are dropped along with
 * the pseudo-class name in front of them.
 */
const withoutFunctionalPseudos = (selector: string): string => {
  let out = ""
  let depth = 0
  for (let at = 0; at < selector.length; at += 1) {
    const char = selector[at]!
    if (char === "(") {
      depth += 1
      // Drop the `:name` sitting in front of this group, back to the colon.
      if (depth === 1) out = out.replace(/:[A-Za-z-]+$/, "")
      continue
    }
    if (char === ")") {
      if (depth > 0) depth -= 1
      continue
    }
    if (depth === 0) out += char
  }
  return out
}

/**
 * A selector narrowed to the structure that GitHub does not reword.
 *
 * The narrow band tells home's sidebar from the feed's by a label and a `:has()`; this
 * keeps the `aside.feed-left-sidebar` at the heart of it and lets the reworded parts go.
 * A compound left with nothing but its qualifiers becomes `*`, so a chain never loses a
 * step and starts matching a parent.
 *
 * The point is the pair: a band that no longer matches while its own coarse form still
 * matches a *visible* element is a band GitHub moved out from under, which is the one
 * shape of drift a running page can prove on its own.
 */
/**
 * The compounds of a selector, split on the descendant combinator alone.
 *
 * Not `split(/\s+/)`: an attribute value carries its own spaces — `[aria-label="Dashboard
 * menu"]` is one qualifier with a space in it — and a naive split tears it in two. So the
 * space that separates compounds is the one found outside every bracket.
 */
const compoundsOf = (selector: string): ReadonlyArray<string> => {
  const parts: Array<string> = []
  let current = ""
  let depth = 0
  for (const char of selector) {
    if (char === "[") depth += 1
    else if (char === "]") depth = Math.max(0, depth - 1)
    if (depth === 0 && /\s/.test(char)) {
      if (current.length > 0) parts.push(current)
      current = ""
      continue
    }
    current += char
  }
  if (current.length > 0) parts.push(current)
  return parts
}

export const coarsen = (selector: string): string =>
  compoundsOf(withoutFunctionalPseudos(selector))
    .map((part) => {
      const structural = part.replace(/\[[^\]]*\]/g, (attr) =>
        NATURAL_ATTRS.some((name) => attr.startsWith(`[${name}`)) ? "" : attr
      )
      return structural === "" ? "*" : structural
    })
    .join(" ")

/** One place GitHub's page is still showing where the takeover meant to hide it. */
export type Leak = {
  readonly place: string
  /** The band as written, the one that stopped matching. */
  readonly narrow: string
  /** Its structural family, the one still on the page. */
  readonly coarse: string
  /** What the leaked element is, for the report to name without a screenshot. */
  readonly found: string
}

/** How an element is named in a leak, short enough for one line in a report. */
const named = (element: Element): string => {
  const parts = [element.tagName.toLowerCase()]
  if (element.id) parts.push(`#${element.id}`)
  for (const name of element.classList) parts.push(`.${name}`)
  return parts.join("")
}

/** Whether an element is taking up space on the page, the browser answer. */
const paints = (element: Element): boolean => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const HIDDEN = "data-gitquiet-hidden"
const LEAVING = "data-gitquiet-leaving"

/** Ours, or standing inside ours: never a leak. */
const isOurs = (element: Element, root: Element | null): boolean =>
  element.id === ROOT_ID ||
  (root !== null && (element === root || root.contains(element) || element.contains(root)))

/**
 * Every band this place still means to hide but no longer matches, while its coarse
 * form is on the page and painting.
 *
 * `isVisible` is taken rather than measured so the check can be tested. A browser passes
 * layout; jsdom has none, so a test passes its own answer and the selector logic — the
 * half that actually broke — is what gets exercised.
 */
export const leaksIn = (
  target: Document,
  place: Place,
  isVisible: (element: Element) => boolean = paints
): ReadonlyArray<Leak> => {
  const root = target.getElementById(ROOT_ID)
  const leaks: Array<Leak> = []

  for (const narrow of place.bands) {
    // The band still matches: it hid what it names, nothing drifted.
    if (target.querySelector(narrow) !== null) continue

    const coarse = coarsen(narrow)
    // No structure was dropped, so there is no coarser thing to have leaked: the
    // element is simply gone, which is not a fault.
    if (coarse === narrow) continue

    for (const candidate of target.querySelectorAll(coarse)) {
      if (isOurs(candidate, root)) continue
      if (candidate.hasAttribute(HIDDEN) || candidate.hasAttribute(LEAVING)) continue
      if (!isVisible(candidate)) continue
      leaks.push({ place: place.name, narrow, coarse, found: named(candidate) })
      break
    }
  }

  return leaks
}

/** The error a leak is reported as, worded off the coarse form so it groups stably. */
export class GateLeak extends Error {
  readonly leaks: ReadonlyArray<Leak>
  constructor(place: string, leaks: ReadonlyArray<Leak>) {
    const where = leaks.map((leak) => leak.coarse).join(", ")
    super(`gate leak on "${place}": ${leaks.length} of their region(s) still shown (${where})`)
    this.name = "GateLeak"
    this.leaks = leaks
  }
}

/** Milliseconds waited before the audit, for GitHub's own React to have settled. */
const SETTLE = 2_500

/**
 * Checks the takeover once, a little later, and reports what it finds.
 *
 * Late on purpose. GitHub inserts the modules a band hides after the shell paints, so a
 * check the instant the takeover finishes would call a region a leak that a correct
 * selector was about to hide a frame later. A persistent leak — a whole sidebar the gate
 * never had the right name for — is still there at `SETTLE` and every moment after, so
 * one late look catches it without crying at the flashes a right selector fixes itself.
 *
 * Its own failure is swallowed to a report: an audit that threw on a page it did not
 * understand would be a worse fault than the one it looks for.
 *
 * A leak goes two ways, and both respect that this extension collects nothing. `reportError`
 * reaches Sentry only in a build carrying a DSN, and none is shipped — so in the store it is
 * silent by design. The console line is the one a person actually reads, and it is on only
 * in a development build, where the page is the developer's own and no reader is watching it.
 */
const announce = (place: string, leaks: ReadonlyArray<Leak>): void => {
  if (import.meta.env.DEV !== true) return
  for (const leak of leaks)
    // eslint-disable-next-line no-console -- dev-only, never in a shipped build
    console.warn(
      `[gitquiet] gate leak on "${place}": ${leak.narrow} misses, ${leak.coarse} is still on the page (${leak.found})`
    )
}

export const auditTakeover = (target: Document, place: Place): void => {
  const view = typeof document === "undefined" ? null : target.defaultView
  if (view === null) return

  view.setTimeout(() => {
    Effect.runSync(
      Effect.try(() => {
        const leaks = leaksIn(target, place)
        if (leaks.length > 0) {
          reportError(new GateLeak(place.name, leaks))
          announce(place.name, leaks)
        }
      }).pipe(Effect.catch((error) => Effect.sync(() => reportError(error))))
    )
  }, SETTLE)
}
