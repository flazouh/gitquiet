import { coarsen } from "./gateAudit"
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
