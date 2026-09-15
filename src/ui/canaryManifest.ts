import type { Place } from "./place"
import type { ProbedPage } from "./probedPages"

/**
 * The selectors a canary needs, flattened to plain data it can read without the bundler.
 *
 * The canary runs under `ego-browser nodejs`, not the build, so it cannot import `place.ts`
 * and the graph of Effect and domain modules behind it. Copying the selectors into the
 * canary by hand would be the very drift this whole effort is against — one table of hooks
 * in two files. So the build writes them out here, joined to the addresses in the ledger,
 * the same way `build-gates.ts` writes the stylesheets. One source, generated twice.
 */

/*
 * Coarsening a band, which used to live in `gateAudit.ts`.
 *
 * That file is gone. It existed to guess at runtime whether a band written
 * against GitHub's markup had stopped matching while their region was still
 * showing, and the guess was unsound — it named our own bar as a leak of theirs
 * on every pull request. Nothing places or hides by their selectors now: one rule
 * hides everything in `body` that is not the host.
 *
 * The canary is the last reader of `place.bands`. It reloads live pages and
 * reports drift for a person, not for the interface to act on, so it survives the
 * audit — and goes when the rest of that table does.
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

const coarsen = (selector: string): string =>
  compoundsOf(withoutFunctionalPseudos(selector))
    .map((part) => {
      const structural = part.replace(/\[[^\]]*\]/g, (attr) =>
        NATURAL_ATTRS.some((name) => attr.startsWith(`[${name}`)) ? "" : attr
      )
      return structural === "" ? "*" : structural
    })
    .join(" ")

/** A band and the structural family it narrows, both, so the canary can tell drift apart. */
export type CanaryBand = {
  readonly narrow: string
  readonly coarse: string
}

/** One live page the canary reloads, with everything it asserts against it. */
export type CanaryTarget = {
  readonly place: string
  readonly page: string
  readonly url: string
  /** Somewhere the takeover can stand; at least one has to be on the page. */
  readonly regions: ReadonlyArray<string>
  /** Everywhere their content is hidden while ours arrives. */
  readonly bands: ReadonlyArray<CanaryBand>
}

export type CanaryManifest = {
  readonly targets: ReadonlyArray<CanaryTarget>
}

/**
 * The targets, one per ledger row that names both a place and a plain address.
 *
 * A row with no `url` needs a repository or a pull request to exist and cannot be reloaded
 * blind; a row with no `place` reads furniture rather than a screen. Either way there is
 * nothing here to reload and assert, so it is left out.
 */
export const manifestFor = (
  places: ReadonlyArray<Place>,
  probed: ReadonlyArray<ProbedPage>
): CanaryManifest => {
  const targets: Array<CanaryTarget> = []

  for (const row of probed) {
    if (row.url === undefined || row.place === undefined) continue

    const place = places.find((one) => one.name === row.place)
    if (place === undefined)
      throw new Error(`canary ledger names place "${row.place}", which is not in place.ts`)

    targets.push({
      place: place.name,
      page: row.page,
      url: row.url,
      regions: [...new Set([...place.regions, ...(place.stages ?? [])])],
      bands: place.bands.map((narrow) => ({ narrow, coarse: coarsen(narrow) }))
    })
  }

  return { targets }
}

/** The committed JSON, trailing newline and all, for the generator and its test to share. */
export const manifestJson = (
  places: ReadonlyArray<Place>,
  probed: ReadonlyArray<ProbedPage>
): string => `${JSON.stringify(manifestFor(places, probed), null, 2)}\n`
