export const ROOT_ID = "githubpro-root"

/**
 * Replaces GitHub's rendered page rather than layering on top of it, so their
 * scripts have nothing left to re-render into and we own the whole surface.
 * Anything the caller needs from the original document must be read first.
 */
export const takeOverPage = (
  target: Document,
  render: (container: Element) => void
): void => {
  const container = target.createElement("div")
  container.id = ROOT_ID
  target.body.replaceChildren(container)

  // The host page's margins and its scrolling would otherwise leak into ours,
  // and the Control Center's whole claim is that it does not scroll.
  for (const element of [target.documentElement, target.body]) {
    element.style.margin = "0"
    element.style.padding = "0"
    element.style.height = "100%"
    element.style.overflow = "hidden"
  }

  render(container)
}
