export const OWNED_TRAVERSAL = "gitquiet:owned-traversal"
export const PREPARED_TRAVERSAL_ROUTE = "data-gitquiet-prepared-traversal-route"
const PREPARED_TRAVERSAL_OFFER = "data-gitquiet-prepared-traversal-offer"

/** Offers a traversal from the page world through the DOM shared with content scripts. */
export const offerPreparedTraversal = (target: Document, route: string): void => {
  target.documentElement.setAttribute(PREPARED_TRAVERSAL_OFFER, route)
}

/** Receives a prepared traversal in the extension world before the address commits. */
export const whenPreparedTraversalIsOffered = (
  target: Document,
  onOffer: (route: string) => void
): (() => void) => {
  const observer = new MutationObserver(() => {
    const route = target.documentElement.getAttribute(PREPARED_TRAVERSAL_OFFER)
    if (route === null) return
    target.documentElement.removeAttribute(PREPARED_TRAVERSAL_OFFER)
    onOffer(route)
  })
  observer.observe(target.documentElement, {
    attributes: true,
    attributeFilter: [PREPARED_TRAVERSAL_OFFER]
  })
  return () => observer.disconnect()
}

/** Tracks one live history screen from its early activation to its address commit. */
export const preparedArrival = () => {
  let route: string | null = null

  return {
    start: (path: string): void => {
      route = path
    },
    committed: (path: string): boolean => {
      if (path !== route) return false
      route = null
      return true
    }
  }
}
