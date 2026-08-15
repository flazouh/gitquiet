/**
 * Builds the extension's icon and the desktop app's out of the brand mark.
 *
 *     bun scripts/build-icons.ts
 *
 * Writes `public/icon/16.png`, `32.png`, `48.png` and `128.png`, which is where WXT
 * looks for them: a PNG under that folder named for its own width becomes an entry of
 * the manifest's `icons`, and nothing in `wxt.config.ts` has to name it.
 *
 * Writes `desktop/icon.iconset` as well, which is what Electrobun hands `iconutil` to
 * get the `.icns` a macOS app carries. Those are not the same picture: a toolbar wants
 * the bare mark on whatever colour the browser is, and a Dock wants a tile, because
 * every icon beside it is one and a bare glyph reads as a hole in the row.
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

/** `PAPER` in `site/src/brand.ts`, which is what the mark is drawn on everywhere else. */
const PAPER = "#fbf9f7"

/** The three shapes, without the document around them, so a tile can place them too. */
const shapes = `  <circle cx="15.4" cy="12.2" r="7" stroke-width="2.5" />
  <path d="M22.4 12.2 V23.4" stroke-width="2.5" />
  <circle cx="22.4" cy="25.6" r="2.5" fill="${MARK}" stroke="none" />`

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${MARK}">
${shapes}
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

/** One size of one SVG, rasterised. Through stdin, so no SVG is left for a build to publish. */
const raster = (svg: string, size: number) =>
  execFileSync("rsvg-convert", ["--width", String(size), "--height", String(size)], {
    input: svg,
    maxBuffer: 8 * 1024 * 1024
  })

const at = here("../public/icon")
mkdirSync(at, { recursive: true })

for (const size of SIZES) {
  writeFileSync(`${at}/${size}.png`, raster(mark, size))
  console.log(`  icon/${size}.png`)
}

console.log(`\n${SIZES.length} icon(s) written to public/icon`)

/*
 * The same mark on a tile, for the Dock.
 *
 * macOS draws every app icon as a rounded square inset in its canvas, and has since
 * Big Sur: 824 of 1024 across, with a corner a little over a fifth of that. An icon
 * that fills its canvas instead is the one that looks wrong beside the others, so
 * these two fractions are Apple's and not a taste.
 *
 * Paper under a purple mark, which is the pairing the landing page and the store
 * images already use. The mark is centred on its own 32 grid — the ring, the stem and
 * the dot together measure 24.15 tall — so its height is what gets scaled, to a little
 * over half the tile, leaving the margin a tile is supposed to have inside it.
 */
const INSET = (1024 - 824) / 2 / 1024
const CORNER = 0.225
const GLYPH = 0.6
const MARK_HEIGHT = 24.15
const MARK_MIDDLE = 16.025

const tile = (size: number) => {
  const side = size * (1 - 2 * INSET)
  const scale = (side * GLYPH) / MARK_HEIGHT
  const shift = size / 2 - MARK_MIDDLE * scale

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${size * INSET}" y="${size * INSET}" width="${side}" height="${side}" rx="${side * CORNER}" fill="${PAPER}" />
  <g transform="translate(${shift} ${shift}) scale(${scale})" fill="none" stroke="${MARK}">
${shapes}
  </g>
</svg>
`
}

/*
 * What `iconutil` reads. Each size twice over, named for the size it is drawn at and
 * for the size it stands in for on a retina screen, which is the naming it refuses to
 * work without.
 */
const ICONSET = [16, 32, 128, 256, 512]

const iconset = here("../desktop/icon.iconset")
mkdirSync(iconset, { recursive: true })

for (const size of ICONSET) {
  writeFileSync(`${iconset}/icon_${size}x${size}.png`, raster(tile(size), size))
  writeFileSync(`${iconset}/icon_${size}x${size}@2x.png`, raster(tile(size * 2), size * 2))
  console.log(`  icon_${size}x${size}.png, icon_${size}x${size}@2x.png`)
}

console.log(`\n${ICONSET.length * 2} icon(s) written to desktop/icon.iconset`)
