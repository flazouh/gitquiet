const SHELL = "data-gitquiet-route-shell"

/** Claims the one route shell allowed to run in this document. */
export const claimShell = (target: Document): boolean => {
  if (target.documentElement.hasAttribute(SHELL)) return false

  target.documentElement.setAttribute(SHELL, "")
  return true
}
