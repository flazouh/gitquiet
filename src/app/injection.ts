/**
 * The one thing a page can ask the extension's worker to do: put the interface
 * on this tab.
 *
 * A content script is matched against the URL a document was *loaded* with, and
 * GitHub does not load documents. Someone who opens the pull request list and
 * clicks a pull request never causes a page load, so the pull request match is
 * never tested again and the interface simply never appears — which is the
 * ordinary way of arriving at a pull request, not an edge case.
 *
 * The lightweight script that does run everywhere notices the navigation and
 * sends this. Only the worker can inject, so only the worker can answer it.
 */
export type OpenHere = { readonly githubpro: "open" }

export const openHere: OpenHere = { githubpro: "open" }

export const isOpenHere = (message: unknown): message is OpenHere =>
  typeof message === "object" &&
  message !== null &&
  (message as { githubpro?: unknown }).githubpro === "open"

/**
 * What the worker injects: build outputs rather than sources, named by where
 * WXT puts them. Typed against the actual build, so renaming an entrypoint
 * breaks the compile here rather than the interface in someone's browser.
 */
export const INTERFACE_SCRIPT = "/content-scripts/pull-request.js" as const
export const INTERFACE_STYLES = "/content-scripts/pull-request.css" as const
