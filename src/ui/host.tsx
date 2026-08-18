import { createContext, useContext, type ReactNode } from "react"

/**
 * What the thing around a screen can answer about itself, where a page cannot.
 *
 * The bar is written for a tab: Home is an address, the inbox is an address, and the
 * way out is GitHub's own page underneath ours. A window has none of those. It has no
 * address bar, one webview and nothing behind it, so a link in that strip does not open
 * a page — it replaces the app with one. See `outside.ts` in the window's view.
 *
 * So the two facts the bar cannot work out for itself are handed to it here rather than
 * threaded through every screen that draws one. `within.ts` is the same arrangement for
 * the same reason, and the window already provides that one a line away.
 *
 * Nothing in the extension provides this, which is why every field is optional and the
 * default is a page.
 */
export type Host = {
  /**
   * What Home means, where it is not somewhere to go.
   *
   * In the window the Working Set is a screen this one becomes rather than a page it
   * navigates to, so the mark in the corner is a press. Left out, it stays the link it
   * is on GitHub.
   */
  readonly home?: () => void
  /**
   * What the host keeps at the far end of the tray, past everything about the page.
   *
   * The window's own two: whether there is a new version, and who is signed in. They
   * stood in a strip of their own above this one, which is two strips of chrome over a
   * list — and the second of them held the traffic lights, so half of it could not be
   * drawn in at all.
   */
  readonly tray?: ReactNode
}

const NOWHERE: Host = {}

const TheHost = createContext<Host>(NOWHERE)

export const HostProvider = TheHost.Provider

export const useHost = (): Host => useContext(TheHost)
