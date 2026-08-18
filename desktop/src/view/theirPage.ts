import { pullRequestAt, THEIRS } from "./following"

/**
 * What a link in this window means, which is one of three things and never a maybe.
 *
 * A union rather than an address or nothing, because "nothing" was three different
 * answers wearing one value: a hash, which is not somewhere to go; a pull request,
 * which a screen in here answers; and a bare `about.md` or `//host/x`, which nobody
 * could place. The third one fell through to the webview and took the app with it,
 * which is the fault this rule exists to prevent.
 */
export type Meaning =
  /** Not a place: a hash, a `mailto:`, a `tel:`. The press is nobody's business. */
  | { readonly at: "nowhere" }
  /** A page, GitHub's or somebody's own, for the reader's browser. */
  | { readonly at: "outside"; readonly url: string }
  /**
   * Something this window is or becomes.
   *
   * A pull request, which a row turns into a card, and every link nobody can place:
   * both mean the webview must not move, and neither is the browser's. The screens
   * under this rule read a press that was stopped — see `workingSet.tsx`.
   */
  | { readonly at: "inside" }

/** What is written as a link but goes nowhere, so following one means nothing. */
const NOT_A_PLACE = /^(?:#|mailto:|tel:|sms:|javascript:)/i

/** A whole address, which is the only spelling this window does not have to resolve. */
const WHOLE = /^https?:\/\//i

/**
 * The whole address a link names, where this window can say what that is.
 *
 * Two spellings, because the interface above is written for a page of GitHub's and
 * uses both: the card writes whole addresses so that copy-link and Cmd-click carry
 * something a browser can use, and the bar writes paths — `/notifications`, a
 * repository's tabs, every row of every menu — because on a page a path is the
 * shortest true thing to write.
 *
 * A path is resolved against GitHub by hand rather than read off the anchor. The
 * anchor resolves against this webview, whose origin is a build directory, so
 * `/notifications` there is a file that has never existed.
 *
 * Nothing for anything else. A relative `docs/x`, a `?tab=`, a `//host/x`: each of
 * them would move the webview, and none of them says anywhere this window can send
 * a reader, so the answer is that there is no address rather than a guess at one.
 */
const whole = (href: string, resolved: string | undefined): string | null => {
  // Case-insensitive because a scheme is: `HTTPS://GitHub.com` is a link a browser
  // follows, and reading it as relative sent it to the branch that stops a press.
  if (WHOLE.test(href)) return resolved ?? href

  if (href.startsWith("//") || !href.startsWith("/")) return null

  return `${THEIRS}${href}`
}

/**
 * A path used to be left alone, on the grounds that nothing in the window navigates
 * to one. The bar arrived in the title row and did: pressing the inbox unloaded the
 * app and left GitHub's own notifications page inside a window with no address bar
 * and no way back.
 *
 * Its own file rather than a line inside `outside.ts`, because that module reaches the
 * main process the moment it is imported — it holds the `ask` that opens a browser —
 * and a decision worth reading back is worth being able to read without a window
 * around it.
 */
export const theirPage = (href: string, resolved?: string | undefined): Meaning => {
  const written = href.trim()
  if (written === "" || NOT_A_PLACE.test(written)) return { at: "nowhere" }

  const address = whole(written, resolved)
  if (address === null) return { at: "inside" }

  // Asked once, of the whole address, so the two spellings cannot disagree about
  // one link. Asked of the path alone, an absolute link to a pull request went to
  // the browser while the same pull request written as a path opened the card.
  return pullRequestAt(address) === null ? { at: "outside", url: address } : { at: "inside" }
}
