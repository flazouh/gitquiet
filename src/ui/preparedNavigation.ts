export const OWNED_TRAVERSAL = "gitquiet:owned-traversal"
export const PREPARED_TRAVERSAL_ROUTE = "data-gitquiet-prepared-traversal-route"
const PREPARED_TRAVERSAL_OFFER = "data-gitquiet-prepared-traversal-offer"

const preparedMarker = (target: Document): HTMLMetaElement | null =>
  target.querySelector(`meta[name="${PREPARED_TRAVERSAL_ROUTE}"]`)

/**
 * How many routes may be armed at once.
 *
 * One slot was the whole of it, and one slot is why the browser's own Back
 * button never went fast: every navigation leaves a page worth returning to,
 * and the next arm threw the last one away. Eight matches the live screen
 * cache in `mount.ts` — an armed route whose tree has been evicted is a guard
 * intercept that ends in a rebuild, so arming further back buys nothing.
 */
const HOW_MANY_ARMED = 8

/*
 * Space-separated in one meta, newest last. A URL path never holds a literal
 * space — the page world's guard and this world both read the same attribute,
 * and one attribute is the whole channel between them.
 */
const armedRoutes = (target: Document): ReadonlyArray<string> => {
  const content = preparedMarker(target)?.content
  return content === undefined || content === "" ? [] : content.split(" ")
}

const writeArmed = (target: Document, routes: ReadonlyArray<string>): void => {
  if (routes.length === 0) {
    preparedMarker(target)?.remove()
    return
  }
  const marker = preparedMarker(target) ?? target.createElement("meta")
  marker.name = PREPARED_TRAVERSAL_ROUTE
  marker.content = routes.join(" ")
  if (!marker.isConnected) (target.head ?? target.documentElement).append(marker)
}

/** Arms one route without invalidating styles across the page root. */
export const markPreparedTraversal = (target: Document, route: string): void => {
  const routes = armedRoutes(target).filter((armed) => armed !== route)
  routes.push(route)
  writeArmed(target, routes.slice(-HOW_MANY_ARMED))
}

/** The newest route that can use its live cached screen, if any is armed. */
export const preparedTraversal = (target: Document): string | null => {
  const routes = armedRoutes(target)
  return routes.length === 0 ? null : (routes[routes.length - 1] ?? null)
}

/** Whether this exact route is armed for a history traversal. */
export const armedTraversal = (target: Document, route: string): boolean =>
  armedRoutes(target).includes(route)

/** Disarms one route after its cached screen takes control, or every route. */
export const clearPreparedTraversal = (target: Document, route?: string): void => {
  if (route === undefined) {
    preparedMarker(target)?.remove()
    return
  }
  writeArmed(target, armedRoutes(target).filter((armed) => armed !== route))
}

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
