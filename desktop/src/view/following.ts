import type { PullRequestRef } from "../../../src/domain/PullRequestRef"

/**
 * What following a link to a pull request means in a window.
 *
 * The shared list draws its rows as anchors to github.com, and that is the right
 * markup on either platform: a row is a link to a pull request, it belongs in the
 * middle-click menu, and its address is worth having in the status bar. What
 * differs is what following one does. In the extension it is a navigation — GitHub
 * load their own conversation tab and the card takes it over on arrival — and there
 * is nothing to intercept. In this window there is no page to arrive at, so
 * following a row means the window becoming that card, and the anchor's own
 * behaviour has to be stopped.
 *
 * Which is why the press is caught here rather than added to the shared row. The
 * row is not missing a handler; the window is deciding what its links mean.
 */

const PULL = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:$|[/#?])/

/**
 * The pull request an address names, if it names one.
 *
 * Read from the path rather than matched against the whole string, so a link to a
 * comment, a file or a specific commit inside a pull request still opens the card
 * it belongs to.
 */
export const pullRequestAt = (href: string): PullRequestRef | null => {
  let path: string

  try {
    const url = new URL(href, "https://github.com")
    // Anything that is not GitHub is somebody's own link in a description, and
    // following it is the browser's business rather than this window's.
    if (url.hostname !== "github.com") return null
    path = url.pathname
  } catch {
    return null
  }

  const found = PULL.exec(path)
  if (found === null) return null

  const [, owner, repo, number] = found
  if (owner === undefined || repo === undefined || number === undefined) return null

  return { owner, repo, number: Number(number) }
}

/**
 * What to do about a press on something inside the list.
 *
 * Three answers, and the modifiers are the reason for the third: a reader holding
 * command means "not here", and a window that swallowed that would be taking away
 * the one thing the anchor was for. A press with no pull request under it — the
 * filter box, a heading, the space between rows — is nobody's business but the
 * screen's, and is left alone.
 */
export type Pressed =
  | { readonly at: "nothing" }
  | { readonly at: "card"; readonly reference: PullRequestRef }
  | { readonly at: "browser"; readonly href: string }

export const pressed = (
  target: EventTarget | null,
  how: { readonly button: number; readonly metaKey: boolean; readonly ctrlKey: boolean; readonly shiftKey: boolean; readonly altKey: boolean }
): Pressed => {
  // The right button is a context menu, which is the platform's to draw.
  if (how.button !== 0 && how.button !== 1) return { at: "nothing" }

  const anchor = target instanceof Element ? target.closest("a[href]") : null
  if (anchor === null) return { at: "nothing" }

  const href = anchor.getAttribute("href")
  if (href === null) return { at: "nothing" }

  const reference = pullRequestAt(href)
  if (reference === null) {
    // A link out of the list that is not a pull request — a repository, a person,
    // a check's own page. GitHub's, and so the browser's.
    return href.startsWith("http") ? { at: "browser", href } : { at: "nothing" }
  }

  const elsewhere = how.button === 1 || how.metaKey || how.ctrlKey || how.shiftKey || how.altKey
  return elsewhere ? { at: "browser", href: anchor instanceof HTMLAnchorElement ? anchor.href : href } : { at: "card", reference }
}
