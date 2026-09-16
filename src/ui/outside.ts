/**
 * The elements of ours that cannot live inside our root.
 *
 * Two of them have to: a bar stands above the page rather than inside the region of it we
 * replaced, and a hover card has to escape whatever the row it belongs to is clipped by. Both are
 * therefore in `document.body`, where three things we take for granted stop being true — the
 * theme tokens are inline custom properties on `#gitquiet-root`, and so is the half of Tailwind's
 * preflight this interface keeps (border reset, box sizing), because the rest of the document is
 * GitHub's page and resetting that would take their own chrome with it.
 *
 * The cost of forgetting was a bar painted white with near-black text on a dark page, and a hover
 * card the same. So every such element is marked, once, and both the stylesheet and the theme
 * look for the mark: a new one gets the treatment by existing rather than by being remembered.
 */

import { OUTSIDE, ROOT_ID } from "./mount"

/**
 * The mark. Read by `primer.css`, `quiet.css` and {@link Theme}. Defined in `mount.ts`
 * — this file imports it, so a definition here would be a cycle — and re-exported from
 * here, where the story above is the reason it exists.
 */
export { OUTSIDE };

/** Where the hover cards, and anything else Radix portals, are put. */
export const OVER_ID = "gitquiet-over";

/**
 * A host with this id, made if it is not there yet.
 *
 * Idempotent, because it is called from render — a component asking for somewhere to portal to
 * has no idea whether it is the first to ask, and two hosts would mean one of them unpainted.
 */
export const outsideHost = (page: Document, id: string): HTMLElement => {
  const had = page.getElementById(id);
  if (had !== null) return had;

  const host = page.createElement("div");
  host.id = id;
  host.setAttribute(OUTSIDE, "");
  page.body.appendChild(host);
  // Dressed from the root at birth, because a host made during a render happens after the theme
  // has already painted: the first hover card of a session would otherwise be white and every one
  // after it dark. {@link Theme} repaints all of these whenever the scheme changes.
  carryTokens(page, host);
  return host;
};

/** The tokens a painted root is carrying, copied onto a host that has just been made. */
const carryTokens = (page: Document, host: HTMLElement): void => {
  const root = page.getElementById(ROOT_ID);
  if (root === null) return;

  // By index rather than by iterating the declaration. Both are the same list in a
  // browser; only one of them exists in every DOM this runs against.
  for (let at = 0; at < root.style.length; at += 1) {
    const name = root.style.item(at);
    if (name.startsWith("--")) host.style.setProperty(name, root.style.getPropertyValue(name));
  }
  host.style.colorScheme = root.style.colorScheme;
  host.classList.toggle("dark", root.classList.contains("dark"));
};

/** Every host of ours, in document order. */
export const ourOutsides = (page: Document): ReadonlyArray<HTMLElement> => [
  ...page.querySelectorAll<HTMLElement>(`[${OUTSIDE}]`),
];
