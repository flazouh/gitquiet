import type { ReactNode } from "react"
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"

/**
 * A page, into the element its own HTML file keeps for it.
 *
 * Four entries wrote these eight lines out, down to the wording of the throw. The throw
 * is the part worth keeping in one place: an entry whose element is missing renders
 * nothing at all and says nothing about why, and the answer is always the same one.
 */
export const mount = (id: string, page: ReactNode): void => {
  const into = document.getElementById(id)
  if (into === null) throw new Error(`#${id} is missing from the page's HTML`)

  createRoot(into).render(createElement(StrictMode, null, page))
}
