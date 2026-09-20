export const OWNED_ROUTE = "data-gitquiet-owned-route"
const OWNED_ROUTE_OFFER = "data-gitquiet-owned-route-offer"
const OWNED_ROUTE_OFFER_PATH = "data-gitquiet-owned-route-offer-path"
import {
  clearPreparedTraversal,
  offerPreparedTraversal,
  preparedTraversal
} from "../ui/preparedNavigation"

/**
 * The id of the element the interface's shadow root hangs off.
 *
 * Spelled here rather than imported from `theHost`, and the test pins the two
 * together. This module is bundled into the page-world content script, and
 * `theHost` pulls Effect and the whole of `mount` behind it — a cost, and a
 * dependency, that has no business in GitHub's own world.
 */
const HOST = "gitquiet-host"

/**
 * The anchor a press was aimed at, across the shadow boundary.
 *
 * `event.target` is retargeted. A listener outside a shadow tree is told the
 * press landed on that tree's host, not on the element inside it — so the whole
 * interface, living in one shadow root, presses as a single `<div>` and
 * `target.closest("a")` answers null for every link in it. Measured on a
 * repository's pull requests: `target=DIV#gitquiet-host`,
 * `target.closest('a')=false`, and the anchor sitting in `composedPath` all
 * along.
 *
 * Every handler here listens on `window`, so all of them went blind the moment
 * the interface moved into a shadow root — silently, because a handler that
 * finds no link politely does nothing. Before that migration `event.target` was
 * the link itself and this file was right.
 *
 * `event.target` stays as the fallback, for an event with no composed path —
 * which is any synthetic one a test dispatches.
 */
export const pressedLink = (event: Event): HTMLAnchorElement | null => {
  for (const step of event.composedPath()) {
    if (step instanceof HTMLAnchorElement) return step
  }
  const on = event.target
  return on instanceof Element ? on.closest("a") : null
}

/** Marks one link whose next plain click is handled by this extension. */
export const markOwnedRoute = (link: HTMLAnchorElement): void => {
  const href = link.getAttribute("href")
  if (href === null) return
  if (link.getAttribute(OWNED_ROUTE) === href) return
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
  readonly navigationType?: string
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
  /**
   * Every tree an offer can be written into, and a shadow root is one of them.
   *
   * `subtree` does not cross a shadow boundary — a shadow tree is its own node
   * tree, and an observer on `documentElement` hears nothing that happens inside
   * one. The whole interface lives in a shadow root, so from the migration
   * onwards the page world could set an offer on one of our links and this, the
   * half that acts on it, never heard a thing.
   *
   * That was the second half of the same fault as {@link pressedLink}: the guard
   * could not see the link to claim it, and had it claimed one, the claim could
   * not have been heard. Each half hid the other — waking the guard alone turns a
   * press that works into a press that is cancelled and then dropped, which is
   * worse than the blindness was. Measured both ways on a repository's pull
   * requests before this was written.
   */
  const watched = new Set<Node>()
  const watch = (root: Node): void => {
    if (watched.has(root)) return
    watched.add(root)
    observer.observe(root, {
      attributes: true,
      attributeFilter: [OWNED_ROUTE_OFFER],
      subtree: true
    })
  }
  watch(target.documentElement)

  /*
   * The host is stood up by the interface, which is later than this: a content
   * script asks for this before it has drawn anything. So the tree is taken when
   * it appears, and a second observer does the childList half — the one above is
   * an attribute watch and would not hear the host arrive.
   */
  const ourTree = (): ShadowRoot | null => target.getElementById(HOST)?.shadowRoot ?? null
  const standing = ourTree()
  if (standing !== null) watch(standing)

  const arrivals = new MutationObserver(() => {
    const shadow = ourTree()
    if (shadow !== null) watch(shadow)
  })
  arrivals.observe(target.documentElement, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    arrivals.disconnect()
  }
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
  const prepared = preparedTraversal(target)
  if (
    prepared === null ||
    move.navigationType !== "traverse" ||
    move.destination?.sameDocument !== true ||
    move.destination.url === undefined
  )
    return false

  const destination = new URL(move.destination.url)
  if (`${destination.pathname}${destination.search}` !== prepared) return false

  clearPreparedTraversal(target)
  offerPreparedTraversal(target, prepared)
  event.stopImmediatePropagation()
  return true
}

/**
 * Cancels GitHub's answer to a press this extension already completed.
 *
 * Two shapes of answer, and both are one gesture answered twice. A document load
 * for the owned route throws away the screen already drawn, so it is cancelled
 * outright. A push for the address the tab is already showing adds a history
 * entry that says nothing — the reader presses Back and the address does not
 * move — so it is cancelled too. The push this extension made itself is neither:
 * it fires while the address still names the page being left, and a traversal is
 * never touched, because cancelling one is exactly the dead Back button this
 * exists to prevent.
 */
export const guardDuplicateNavigation = (
  owned: string,
  event: NavigationAttempt
): boolean => {
  const destination = new URL(event.destination.url).href
  if (!event.cancelable || destination !== new URL(owned, window.location.href).href)
    return false

  const repeatsTheAddressShown =
    event.navigationType === "push" && destination === window.location.href
  if (event.destination.sameDocument && !repeatsTheAddressShown) return false

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
  const link = pressedLink(event)
  if (link === null) return

  if (
    event.type === "pointerdown" &&
    link.closest("#gitquiet-root, #gitquiet-bar") !== null &&
    link.hostname === window.location.hostname &&
    link.target !== "_blank" &&
    link.target !== "_new" &&
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
