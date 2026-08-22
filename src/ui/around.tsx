import { createContext, useContext, type ReactNode } from "react"

/**
 * What is around a screen, where that is not a tab of GitHub's.
 *
 * The bar is the whole reason this exists. It is written for a page — Home is an
 * address, the inbox is an address, and behind ours is GitHub's own document — and
 * every one of those is false in a window: one webview, no address bar, nothing
 * behind it, so a link in that strip does not open a page but replaces the app with
 * one. See `outside.ts` in the window's view.
 *
 * Three things, one context, read in one place. They were two contexts, `within` and
 * a `host` beside it, provided by the same three call sites and nested one line
 * apart in each of them. Two names for "what is around this screen" is one name too
 * many, and the shape kept inviting a third.
 *
 * Nothing in the extension provides any of it, which is why every field is optional
 * and the default is a page.
 */
export type Around = {
  /**
   * Which element the chrome of this screen belongs inside, where that is not the page.
   *
   * The bar is portalled rather than rendered in place, and `barSlot.ts` says why: on
   * GitHub it has to stand above their page instead of inside the region we replaced,
   * and a node of ours inside their header is a node their React drops between two
   * frames. Portalled to `body`, one per document, sticky at the top.
   *
   * That is right for the extension and wrong for anywhere a screen is one thing among
   * others. The landing page mounts twelve of them down a column, and each one's bar
   * went to the top of the window and lay across the headline. Told which element it is
   * inside, a screen puts its chrome there and the portal stops at its own edge.
   *
   * Left out means the page, which is what the extension means.
   */
  readonly within?: HTMLElement
  /**
   * What Home means, where it is not somewhere to go.
   *
   * In the window the Working Set is a screen this one becomes rather than a page it
   * navigates to, so the mark in the corner is a press. Left out, it stays the link it
   * is on GitHub.
   */
  readonly home?: () => void
  /**
   * What the thing around this screen keeps at the far end of the tray, past
   * everything about the page.
   *
   * The window's own two: whether there is a new version, and who is signed in. They
   * stood in a strip of their own above the bar, which is two strips of chrome over a
   * list — and the second of them held the traffic lights, so half of it could not be
   * drawn in at all.
   */
  readonly tray?: ReactNode
}

/** A page, which is what the extension is and what everything else says it is not. */
const A_PAGE: Around = {}

const TheSurroundings = createContext<Around>(A_PAGE)

export const AroundProvider = TheSurroundings.Provider

export const useAround = (): Around => useContext(TheSurroundings)
