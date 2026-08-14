/**
 * Builds the extension's icon out of the brand mark.
 *
 *     bun scripts/build-icons.ts
 *
 * Writes `public/icon/16.png`, `32.png`, `48.png` and `128.png`, which is where WXT
 * looks for them: a PNG under that folder named for its own width becomes an entry of
 * the manifest's `icons`, and nothing in `wxt.config.ts` has to name it.
 *
 * The output is committed, like the tree's icon sheet, so a build and a release need no
 * rasteriser on the machine. Only running this does, and it needs `rsvg-convert`
 * (`brew install librsvg`): rendering each size from the vector keeps the ring crisp at
 * 16, which reducing the 128 would not.
 *
 * Transparent, and drawn in the brand's one purple at every size. Chrome shows this
 * image on a light toolbar and a dark one, so a baked square would be a light square on
 * somebody's dark browser.
 *
 * The geometry below is the same three shapes as `site/src/Mark.tsx`, which is where the
 * mark is defined for the landing page and for the store's own images. Two copies of it,
 * because the site is a separate app with its own toolchain and nothing here can hand a
 * React component to a rasteriser. Change one and change the other.
 */

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** `MARK` in `site/src/brand.ts`. */
const MARK = "#8b5cf6"

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${MARK}">
  <circle cx="15.4" cy="12.2" r="7" stroke-width="2.5" />
  <path d="M22.4 12.2 V23.4" stroke-width="2.5" />
  <circle cx="22.4" cy="25.6" r="2.5" fill="${MARK}" stroke="none" />
</svg>
`

/**
 * The four Chrome asks for by name.
 *
 * 16 for the favicon of an extension's own page and its context menu entry, 32 because
 * Windows rounds to it and would otherwise reduce the 48 itself, 48 for the row on
 * `chrome://extensions`, and 128 for the store listing and the install dialog.
 */
const SIZES = [16, 32, 48, 128]

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const at = here("../public/icon")
mkdirSync(at, { recursive: true })

for (const size of SIZES) {
  // Through stdin, so no SVG is left in `public` for the build to publish.
  const png = execFileSync(
    "rsvg-convert",
    ["--width", String(size), "--height", String(size)],
    { input: mark, maxBuffer: 1024 * 1024 }
  )
  writeFileSync(`${at}/${size}.png`, png)
  console.log(`  icon/${size}.png`)
}

console.log(`\n${SIZES.length} icon(s) written to public/icon`)
