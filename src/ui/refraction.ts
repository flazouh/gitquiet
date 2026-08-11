/**
 * The lens the bar reads the page through.
 *
 * A `backdrop-filter` of nothing but `blur()` is frosted glass: the page behind the pane goes soft
 * and stays where it was, and the pane reads as opacity with a number on it. What says glass is the
 * page bending as it passes the edge of the pane, and the only way a browser will bend a backdrop
 * is an SVG filter — `feTurbulence` for a field of noise, `feDisplacementMap` to push each pixel of
 * the backdrop by what that field says. It is how every implementation of the effect does it:
 * `lucasromerodb/liquid-glass-effect-macos`, `archisvaze/liquid-glass`, `shuding/liquid-glass` and
 * `rdev/liquid-glass-react` are four takes on the same two primitives.
 *
 * A filter has to be in the document to be referenced from one, and the document here is GitHub's.
 * So the definition is injected, once, beside the bar it belongs to. Nothing else in this interface
 * needs it: the cards are fills and the sheets are surfaces, and a lens is for the one element that
 * floats over a page the reader is still scrolling.
 */

/** The name the stylesheet asks for. See `glass.css`. */
export const REFRACTION_ID = "gitquiet-refraction"

const HOST_ID = "gitquiet-glass"

/*
 * Noise rather than a map drawn to the pane's shape.
 *
 * The cleanest lens is an image whose red and green say how far to push each pixel, ramped up at
 * the edges and flat in the middle — which is what the two demos with a slider do. It also has to
 * be redrawn at the pane's exact size, and this pane is as wide as the window and changes with it.
 * `feTurbulence` is generated in the filter's own space instead, so it costs nothing on a resize
 * and there is no size for it to be wrong about.
 *
 * The frequency is anisotropic on purpose: a forty pixel strip is two hundred times longer than it
 * is deep, and one figure for both axes gives a bend that is either invisible along the length or
 * violent through the depth.
 */
const FILTER = `
<filter id="${REFRACTION_ID}" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.015 0.024" numOctaves="2" seed="5" result="noise" />
  <feGaussianBlur in="noise" stdDeviation="2.4" result="field" />
  <feDisplacementMap in="SourceGraphic" in2="field" scale="22" xChannelSelector="R" yChannelSelector="G" />
</filter>`

/**
 * Puts the definition in the page, once.
 *
 * Nought by nought and out of the flow, rather than `display: none`. A filter defined inside a
 * hidden subtree is one some engines decline to run, and the failure is a bar with no backdrop at
 * all: Chrome drops the whole `backdrop-filter` when the filter it names cannot be resolved.
 */
export const keepRefraction = (page: Document): void => {
  if (page.getElementById(HOST_ID) !== null) return

  const host = page.createElement("div")
  host.id = HOST_ID
  host.setAttribute("aria-hidden", "true")
  host.style.position = "absolute"
  host.style.width = "0"
  host.style.height = "0"
  host.style.overflow = "hidden"
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">${FILTER}</svg>`
  page.body.appendChild(host)
}
