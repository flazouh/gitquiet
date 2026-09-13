import { markOwnedRoute, OWNED_ROUTE } from "./navigationGuard"

/** Protects added links without walking GitHub's hidden page on each update. */
export const protectOwnedLinks = (
  target: Document,
  owns: (link: HTMLAnchorElement) => boolean
): (() => void) => {
  let roots: readonly HTMLElement[] = []
  const protect = (link: HTMLAnchorElement) => {
    if (link.hasAttribute("href") && owns(link)) markOwnedRoute(link)
    else link.removeAttribute(OWNED_ROUTE)
  }
  const update = (changes: readonly MutationRecord[]) => {
    const current = [target.getElementById("gitquiet-root"), target.getElementById("gitquiet-bar")]
      .filter((root) => root !== null)
    const added = new Set<Element>(current.filter((root) => !roots.includes(root)))
    roots = current
    for (const change of changes) {
      if (!roots.some((root) => root.contains(change.target))) continue
      if (change.type === "attributes" && change.target instanceof HTMLAnchorElement)
        added.add(change.target)
      for (const node of change.addedNodes) {
        if (node instanceof Element && roots.some((root) => root.contains(node))) added.add(node)
      }
    }
    for (const node of added) {
      // Nested additions share a traversal, even if records arrive out of order.
      let parent = node.parentElement
      while (parent !== null && !added.has(parent)) parent = parent.parentElement
      if (parent !== null) continue
      if (node instanceof HTMLAnchorElement) protect(node)
      for (const link of node.querySelectorAll<HTMLAnchorElement>("a[href]")) protect(link)
    }
  }
  const observer = new MutationObserver(update)
  observer.observe(target.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["href"]
  })
  update([])
  return () => { observer.disconnect(); roots = [] }
}
