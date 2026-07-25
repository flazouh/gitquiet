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
  render(container)
}
