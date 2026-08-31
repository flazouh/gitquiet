/**
 * Writes the flat selector manifest the live canary reads.
 *
 *     bun scripts/build-canary-manifest.ts          # write it
 *     bun scripts/build-canary-manifest.ts --check  # fail if it is out of date
 *
 * Generated from `place.ts` and `probedPages.ts`, the same tables the gates and the
 * takeover read, so the canary checks the hooks the extension actually uses rather than a
 * second copy of them. `src/ui/canaryManifest.test.ts` fails when the committed file drifts.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { manifestJson } from "../src/ui/canaryManifest"
import { PLACES } from "../src/ui/place"
import { PROBED_PAGES } from "../src/ui/probedPages"

const AT = "src/ui/canary.manifest.json"

const wanted = manifestJson(PLACES, PROBED_PAGES)

if (process.argv.includes("--check")) {
  if (readFileSync(AT, "utf8") !== wanted) {
    console.error(`out of date: ${AT}\n  run: bun scripts/build-canary-manifest.ts`)
    process.exit(1)
  }
} else {
  writeFileSync(AT, wanted)
  console.log(`wrote ${AT}`)
}
