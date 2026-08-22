import {
  guardDuplicateNavigation,
  guardOwnedRoute,
  guardPreparedTraversal,
  OWNED_ROUTE,
  suppressNextEvent
} from "@/app/navigationGuard"
import { defineContentScript } from "wxt/utils/define-content-script"

export default defineContentScript({
  matches: ["*://github.com/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    let protectedRoute: { readonly href: string; readonly until: number } | null = null
    const suppressNextPopstate = suppressNextEvent(window, "popstate")
    const guard = (event: Event): void => {
      const target = event.target
      const link = target instanceof Element ? target.closest("a") : null
      const href = link?.getAttribute(OWNED_ROUTE) ?? null
      guardOwnedRoute(event as MouseEvent)
      if (event.type === "click" && event.defaultPrevented && href !== null)
        protectedRoute = { href, until: performance.now() + 2_000 }
    }

    for (const event of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
      window.addEventListener(event, guard, { capture: true })

    const navigation = (
      window as Window & {
        navigation?: { addEventListener: (name: string, listener: EventListener) => void }
      }
    ).navigation
    navigation?.addEventListener("navigate", ((event: Event) => {
      if (guardPreparedTraversal(event)) {
        suppressNextPopstate()
        return
      }
      if (protectedRoute === null) return
      if (performance.now() > protectedRoute.until) {
        protectedRoute = null
        return
      }
      if (
        guardDuplicateNavigation(
          protectedRoute.href,
          event as Event & {
            readonly destination: { readonly url: string; readonly sameDocument: boolean }
          }
        )
      )
        protectedRoute = null
    }) as EventListener)
  }
})
