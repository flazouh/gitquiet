/**
 * Writes the two stylesheets that keep GitHub's own pages off the screen.
 *
 *     bun scripts/build-gates.ts          # write them
 *     bun scripts/build-gates.ts --check  # fail if they are out of date
 *
 * Both are generated from the table in `src/ui/place.ts`, which is the same table
 * the interfaces search for somewhere to stand. Before this they were three
 * hand-written sheets naming the same regions a second time, and the drift was not
 * hypothetical: when their repository list moved into its Turbo frame, the search
 * coped and the rules matched nothing, which a reader saw as GitHub's list on the
 * screen for 587 milliseconds.
 *
 * The output is committed. A content script's stylesheet has to be in the manifest
 * to be applied before the page is displayed, so this cannot be built at runtime,
 * and neither `bun test` nor `bun dev` should depend on having run a generator.
 * `src/ui/gates.test.ts` fails when the committed files no longer match the table.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { barSheet, loadSheet, PREAMBLE, softSheet } from "../src/ui/gateCss"
import { PLACES } from "../src/ui/place"

/** Where each sheet goes, and what the interfaces import. */
export const SHEETS = [
  { at: "src/ui/gates.load.css", said: () => `${PREAMBLE}\n${loadSheet(PLACES)}` },
  { at: "src/ui/gates.soft.css", said: () => `${PREAMBLE}\n${softSheet(PLACES)}` },
  { at: "src/ui/gates.bar.css", said: () => `${PREAMBLE}\n${barSheet()}` }
] as const

const checking = process.argv.includes("--check")

const stale: Array<string> = []
for (const sheet of SHEETS) {
  const wanted = sheet.said()
  if (checking) {
    const had = readFileSync(sheet.at, "utf8")
    if (had !== wanted) stale.push(sheet.at)
    continue
  }
  writeFileSync(sheet.at, wanted)
  console.log(`wrote ${sheet.at}`)
}

if (stale.length > 0) {
  console.error(`out of date: ${stale.join(", ")}\n  run: bun scripts/build-gates.ts`)
  process.exit(1)
}
