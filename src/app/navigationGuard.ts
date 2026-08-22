export const OWNED_ROUTE = "data-gitquiet-owned-route"
export const OWNED_ROUTE_CLICK = "gitquiet:owned-route-click"
export const OWNED_ROUTE_PRESS = "gitquiet:owned-route-press"
export { OWNED_TRAVERSAL, PREPARED_TRAVERSAL_ROUTE } from "../ui/preparedNavigation"
import { OWNED_TRAVERSAL, PREPARED_TRAVERSAL_ROUTE } from "../ui/preparedNavigation"

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
  target.dispatchEvent(new CustomEvent(OWNED_TRAVERSAL, { detail: prepared }))
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
    link.dispatchEvent(new CustomEvent(OWNED_ROUTE_PRESS, { bubbles: true }))
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

  link.dispatchEvent(new CustomEvent(OWNED_ROUTE_CLICK, { bubbles: true }))
  link.removeAttribute(OWNED_ROUTE)
  window.setTimeout(() => {
    if (!link.hasAttribute("href") && href !== null) link.setAttribute("href", href)
  }, 0)
}
