import { isSecretGist } from "../github/gistVisibility"

/**
 * The banner naming what Secret actually means, on a gist that carries it.
 *
 * Plain DOM, not a React root — this is one node appended beside GitHub's own
 * header, not a region taken over, so there is no place for the takeover
 * machinery `mount.ts` and `standAScreen` exist for. `offerOurPage` in
 * `theirTabs.ts` is the precedent: a small control planted beside GitHub's
 * own markup, built the same way it draws it.
 *
 * GitHub's own `.flash` and `flash-warn` classes, which every one of their
 * pages already ships the stylesheet for — a reader who has never opened this
 * extension has still had this banner's colours on their screen before, on
 * whatever warning GitHub itself last drew.
 */
export const GHOST_ID = "gitquiet-gist-secret-banner"

/**
 * Puts the banner on the page, once, where the gist it is about is Secret.
 *
 * Idempotent: GitHub's `gist-pjax-container` can redraw the header without
 * loading a document, and a second call after that must not stack a second
 * banner behind the first.
 */
export const plantSecretBanner = (page: Document): void => {
  const header = page.querySelector(".gisthead")
  if (header === null) return
  if (page.getElementById(GHOST_ID) !== null) return
  if (!isSecretGist(page)) return

  const banner = page.createElement("div")
  banner.id = GHOST_ID
  banner.className = "flash flash-warn mb-3"
  banner.textContent =
    "Secret means anyone with this link can see this gist — it is not private. " +
    "The link is the only thing keeping it out of a search engine, and once shared " +
    "it cannot be taken back."

  header.after(banner)
}
