import { createContext, useContext } from "react"

/**
 * Which element the chrome of a screen belongs inside, where that is not the page.
 *
 * The bar is the reason this exists. It is portalled rather than rendered in place, and
 * `barSlot.ts` says why: on GitHub it has to stand above their page instead of inside
 * the region we replaced, and a node of ours inside their header is a node their React
 * drops between two frames. Portalled to `body`, one per document, sticky at the top.
 *
 * That is right for the extension and wrong for anywhere a screen is one thing among
 * others. The landing page mounts twelve of them down a column, and each one's bar went
 * to the top of the window and lay across the headline. Told which element it is inside,
 * a screen puts its chrome there and the portal stops at its own edge.
 *
 * `undefined` means the page, which is what the extension means and is therefore the
 * default. Nothing in the extension provides this.
 */
const Within = createContext<HTMLElement | undefined>(undefined)

export const WithinProvider = Within.Provider

export const useWithin = (): HTMLElement | undefined => useContext(Within)
