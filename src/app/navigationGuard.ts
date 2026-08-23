export const OWNED_ROUTE = "data-gitquiet-owned-route"
const OWNED_ROUTE_OFFER = "data-gitquiet-owned-route-offer"
const OWNED_ROUTE_OFFER_PATH = "data-gitquiet-owned-route-offer-path"
import {
  offerPreparedTraversal,
  PREPARED_TRAVERSAL_ROUTE
} from "../ui/preparedNavigation"

/** Marks one link whose next plain click is handled by this extension. */
export const markOwnedRoute = (link: HTMLAnchorElement): void => {
  const href = link.getAttribute("href")
  if (href === null) return
  link.setAttribute(OWNED_ROUTE, href)
}

/** Restores a warmed link when the pointer leaves or asks for a new tab. */
export const restoreOwnedRoute = (link: HTMLAnchorElement): void => {
  const href = link.getAttribute(OWNED_ROUTE)
  link.removeAttribute(OWNED_ROUTE)
  if (href !== null) link.setAttribute("href", href)
}

type NavigationAttempt = {
  readonly cancelable: boolean
  readonly destination: { readonly url: string; readonly sameDocument: boolean }
  readonly preventDefault: () => void
  readonly stopImmediatePropagation: () => void
}

type TraversalAttempt = Event & {
  readonly navigationType?: string
  readonly destination?: { readonly url?: string; readonly sameDocument?: boolean }
}

type OwnedRouteOffer = "press" | "click"

/** Offers one owned link action through the DOM shared by both browser worlds. */
const offerOwnedRoute = (
  link: HTMLAnchorElement,
  kind: OwnedRouteOffer,
  route: string
): void => {
  link.setAttribute(OWNED_ROUTE_OFFER_PATH, route)
  link.setAttribute(OWNED_ROUTE_OFFER, kind)
}

/** Receives owned link actions in the extension world. */
export const whenOwnedRouteIsOffered = (
  target: Document,
  onOffer: (kind: OwnedRouteOffer, route: string, link: HTMLAnchorElement) => void
): (() => void) => {
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      const link = change.target
      if (!(link instanceof HTMLAnchorElement)) continue
      const kind = link.getAttribute(OWNED_ROUTE_OFFER)
      const route = link.getAttribute(OWNED_ROUTE_OFFER_PATH)
      if ((kind !== "press" && kind !== "click") || route === null) continue

      link.removeAttribute(OWNED_ROUTE_OFFER)
      link.removeAttribute(OWNED_ROUTE_OFFER_PATH)
      onOffer(kind, route, link)
    }
  })
  observer.observe(target.documentElement, {
    attributes: true,
    attributeFilter: [OWNED_ROUTE_OFFER],
    subtree: true
  })
  return () => observer.disconnect()
}

/** Stops the next duplicate browser event while leaving later navigation alone. */
export const suppressNextEvent = (target: EventTarget, name: string): (() => void) => {
  let armed = false
  target.addEventListener(
    name,
    (event) => {
      if (!armed) return
      armed = false
      event.stopImmediatePropagation()
    },
    { capture: true }
  )
  return () => {
    armed = true
  }
}

/** Lets the browser commit a prepared traversal without running GitHub's router. */
export const guardPreparedTraversal = (
  event: Event,
  target: Document = document
): boolean => {
  const move = event as TraversalAttempt
  const prepared = target.documentElement.getAttribute(PREPARED_TRAVERSAL_ROUTE)
  if (
    prepared === null ||
    move.navigationType !== "traverse" ||
    move.destination?.sameDocument !== true ||
    move.destination.url === undefined
  )
    return false

  const destination = new URL(move.destination.url)
  if (`${destination.pathname}${destination.search}` !== prepared) return false

  target.documentElement.removeAttribute(PREPARED_TRAVERSAL_ROUTE)
  offerPreparedTraversal(target, prepared)
  event.stopImmediatePropagation()
  return true
}

/** Cancels GitHub's document load after this extension completed the same route. */
export const guardDuplicateNavigation = (
  owned: string,
  event: NavigationAttempt
): boolean => {
  if (
    !event.cancelable ||
    event.destination.sameDocument ||
    new URL(event.destination.url).href !== new URL(owned, window.location.href).href
  )
    return false

  event.preventDefault()
  event.stopImmediatePropagation()
  return true
}

/**
 * Keeps GitHub's router out of a route that the isolated extension world owns.
 *
 * GitHub still runs layout work for a cancelled click. This listener runs in the
 * page world, cancels that work, then sends the route back to the extension world.
 */
export const guardOwnedRoute = (event: MouseEvent): void => {
  const target = event.target
  if (!(target instanceof Element)) return
  const link = target.closest<HTMLAnchorElement>("a")
  if (link === null) return

  if (
    event.type === "pointerdown" &&
    link.closest("#gitquiet-root, #gitquiet-bar") !== null &&
    link.hostname === window.location.hostname &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  ) {
    event.stopImmediatePropagation()
    offerOwnedRoute(link, "press", link.getAttribute("href") ?? link.href)
    return
  }

  if (!link.hasAttribute(OWNED_ROUTE)) return

  const href = link.getAttribute(OWNED_ROUTE)
  const plain = !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
  if (!plain) {
    restoreOwnedRoute(link)
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.type !== "click") return

  if (href !== null) offerOwnedRoute(link, "click", href)
  link.removeAttribute(OWNED_ROUTE)
  window.setTimeout(() => {
    if (!link.hasAttribute("href") && href !== null) link.setAttribute("href", href)
  }, 0)
}
