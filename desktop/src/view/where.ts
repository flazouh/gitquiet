import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { BROWSER } from "../../../src/ui/marks"

/**
 * Where a press in this window goes, decided in one place.
 *
 * The interface above this is written for a page of GitHub's, so it is full of
 * anchors, and that is the right markup on either platform: a row is a link to a pull
 * request, it belongs in the middle-click menu, and its address is worth having when
 * the reader copies it. What differs is what following one does. The extension is
 * standing on the page the link goes to and lets the browser navigate; this window is
 * the interface, with no address bar, no back button and no tab to close, so a link it
 * follows does not open a page — it replaces the app with one, and the only way back
 * is to quit.
 *
 * Four answers, and the reason they are all in this one function is the bug that put
 * them here. There were three rules in three files: the list's own reading of a press,
 * a document rule that stopped every anchor, and an exception for commits. The
 * document rule ran first and answered "a pull request is drawn in here" — true of the
 * list, and true of nothing on the card, where the header's own "Open on GitHub"
 * points at the pull request being read. So that button was stopped, handed to a
 * screen that was not listening, and did nothing at all for a month.
 */
export type Where =
  /** Not a link press. Nobody stops it, and whatever the screen makes of it stands. */
  | { readonly at: "nothing" }
  /** This window becomes that pull request. */
  | { readonly at: "card"; readonly reference: PullRequestRef }
  /** Handed to the main process, which opens it where the reader's browser is. */
  | { readonly at: "outside"; readonly url: string }
  /** Stopped, and drawn by the screen the press was on: a commit, in a panel of the card's own. */
  | { readonly at: "drawn" }
  /**
   * Stopped, and nobody can say where it was going.
   *
   * Its own arm rather than a second meaning for the one above, which is the fault the
   * three files this replaces were built out of: one value that meant both "somebody
   * here is about to answer this" and "nobody ever will". They read the same at the
   * press and they are opposite facts, and the button in the corner of the card spent a
   * month being the second while every comment in the code said it was the first.
   */
  | { readonly at: "unplaceable"; readonly written: string }

/** Which keys were down, which is the difference between here and elsewhere. */
export type Press = {
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

/**
 * Where a path written in this window means, which is never this window.
 *
 * The interface above is written for a page of GitHub's, so a path in it is a path on
 * theirs. This webview's own origin is a build folder, so anything resolved against it
 * is a file that has never existed.
 */
export const THEIRS = "https://github.com"

const PULL = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:$|[/#?])/

/**
 * The pull request an address names, if it names one.
 *
 * Read from the path rather than matched against the whole string, so a link to a
 * comment, a file or a specific commit inside a pull request still opens the card it
 * belongs to.
 */
export const pullRequestAt = (href: string): PullRequestRef | null => {
  let path: string

  try {
    const url = new URL(href, THEIRS)
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

const COMMIT = /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]+/i
/** Not a place this window can go, and not a place it stops the reader going. */
const NOT_A_PLACE = /^(?:#|mailto:|tel:|sms:|javascript:)/i
const WHOLE = /^https?:\/\//i

/**
 * The whole address a written one means.
 *
 * A path is GitHub's, because the interface above was written for their page, and it is
 * resolved against theirs by hand rather than read off the anchor: this webview's own
 * origin is a build folder, so the anchor's own `href` for a path names a file that has
 * never existed. An address already written out in full is taken from the anchor, which
 * is what normalises the odd ones — a case-shifted scheme, or a `..` in the middle.
 */
const whole = (href: string, resolved: string | undefined): string | null => {
  if (WHOLE.test(href)) return resolved ?? href
  if (href.startsWith("//") || !href.startsWith("/")) return null
  return `${THEIRS}${href}`
}

/** A commit of theirs, which the card draws rather than sending anybody to a browser. */
const isCommit = (address: string): boolean => {
  try {
    const url = new URL(address)
    return url.hostname === "github.com" && COMMIT.test(url.pathname)
  } catch {
    return false
  }
}

export const where = (target: EventTarget | null, how: Press): Where => {
  // The right button is a context menu, which is the platform's to draw.
  if (how.button !== 0 && how.button !== 1) return { at: "nothing" }

  const anchor = target instanceof Element ? target.closest("a[href]") : null
  if (anchor === null) return { at: "nothing" }

  const written = (anchor.getAttribute("href") ?? "").trim()
  if (NOT_A_PLACE.test(written)) return { at: "nothing" }
  // An empty one is not nothing. A browser reloads the document for it, and a reload in
  // here is the app starting over with everything the reader had done thrown away.
  if (written === "") return { at: "unplaceable", written }

  const address = whole(written, anchor instanceof HTMLAnchorElement ? anchor.href : undefined)
  if (address === null) return { at: "unplaceable", written }

  if (anchor.hasAttribute(BROWSER)) return { at: "outside", url: address }

  /*
   * A held key or the middle button is the reader asking for somewhere that is not here,
   * and a window that swallowed that would be taking away the one thing an anchor was
   * for.
   *
   * Not Alt, which in a browser means download rather than elsewhere. Nobody holds it
   * meaning "open this where my tabs are", so it is left to mean a plain press.
   */
  if (how.button === 1 || how.metaKey || how.ctrlKey || how.shiftKey) {
    return { at: "outside", url: address }
  }

  if (isCommit(address)) return { at: "drawn" }

  const reference = pullRequestAt(address)
  return reference === null ? { at: "outside", url: address } : { at: "card", reference }
}
