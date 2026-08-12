/**
 * Taken off acepe.dev rather than invented, so the two products look related.
 *
 * There the pastel band is a frame: a near-black page with one bright bed behind
 * the product shot. Same job here, holding two screenshots instead of one.
 *
 * Read with `getComputedStyle` on the live page, not sampled from a screenshot,
 * so the stops are theirs exactly.
 */
export const PAGE = "#121212";
export const GRADIENT =
  "linear-gradient(110deg, rgb(255,154,209) 0%, rgb(255,198,157) 22%, rgb(236,224,255) 48%, rgb(169,194,255) 72%, rgb(183,155,255) 100%)";

/** Type on the dark page. */
export const INK = "#f4f2ef";
export const MUTED = "#8b8b8b";

/** Type on the pastel bed, which is far too light for the page's own ink. */
export const ON_GRADIENT = "#1b1725";
export const ON_GRADIENT_MUTED = "#5b5470";
