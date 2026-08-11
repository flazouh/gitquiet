import { Option } from "effect"

/**
 * The signed-in reader's invented handle, shared across every mock that draws a viewer.
 *
 * A single constant here so that changing the viewer's name means changing one line
 * rather than hunting through five files. The handle is clearly fictional so that no
 * real person's identity appears in a public marketing screenshot.
 */
export const MOCK_VIEWER = "rmeadows"

/**
 * Inline SVG avatars, drawn locally with no network request.
 *
 * Earlier captures fetched real avatars from https://github.com/<login>.png?size=48.
 * That route has two problems for a screenshot harness: it sends real people's faces
 * into a public marketing image without their knowledge, and lazy-loaded images have
 * a race with the shutter, producing captures with eight grey circles where faces
 * should be. A locally-drawn data URI cannot lose that race and carries no real face.
 *
 * The colour is derived from the login by a small hash so the same handle always
 * gets the same colour across rebuilds. The first letter of the handle is centred on
 * a 48×48 square, which is the size the extension draws avatars at.
 */

/**
 * A hue from the handle, so the same person is the same colour in every screen.
 *
 * Any hash would do. This one is the usual multiply-by-31 walk, kept because a face
 * that changed colour between the Working Set and the pull request it links to would
 * read as two people, and the twelve screens are photographed one at a time.
 */
const hueOf = (login: string): number => {
  let sum = 0
  for (let at = 0; at < login.length; at += 1) {
    sum = (Math.imul(31, sum) + login.charCodeAt(at)) | 0
  }
  return Math.abs(sum) % 360
}

/** Lightness low enough that the white letter on it clears AA at 22 pixels. */
const faceOn = (hue: number) => `hsl(${hue}, 50%, 38%)`

export const faceDataUri = (login: string): string => {
  const initial = login.replace(/[^A-Za-z]/g, "")[0]?.toUpperCase() ?? "?"
  const drawing =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">` +
    `<rect width="48" height="48" fill="${faceOn(hueOf(login))}"/>` +
    `<text x="24" y="33" text-anchor="middle" ` +
    `font-family="system-ui,sans-serif" font-size="22" font-weight="600" ` +
    `fill="white">${initial}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(drawing)}`
}

export const faceOf = (login: string): Option.Option<string> => Option.some(faceDataUri(login))
