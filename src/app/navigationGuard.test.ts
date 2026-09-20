import { describe, expect, test } from "bun:test"
import { HOST_ID } from "@/ui/theHost"
import {
  guardOwnedRoute,
  guardDuplicateNavigation,
  markOwnedRoute,
  OWNED_ROUTE,
  guardPreparedTraversal,
  suppressNextEvent,
  whenOwnedRouteIsOffered,
  pressedLink
} from "./navigationGuard"
import {
  markPreparedTraversal,
  PREPARED_TRAVERSAL_ROUTE,
  preparedTraversal,
  whenPreparedTraversalIsOffered
} from "../ui/preparedNavigation"

describe("the page-world guard for an owned route", () => {
  test("does not rewrite an unchanged owned route", () => {
    const link = document.createElement("a")
    link.href = "/owner/repo/pull/2"
    const setAttribute = link.setAttribute.bind(link)
    let writes = 0
    Object.defineProperty(link, "setAttribute", {
      value: (name: string, value: string) => {
        writes += 1
        setAttribute(name, value)
      }
    })

    markOwnedRoute(link)
    markOwnedRoute(link)

    expect(writes).toBe(1)
  })

  test("leaves a new-tab bar link for the browser", async () => {
    const bar = document.createElement("div")
    bar.id = "gitquiet-bar"
    bar.innerHTML =
      '<a href="https://github.com/flazouh/gitquiet/issues" target="_blank">Report</a>'
    document.body.append(bar)
    const link = bar.querySelector("a") as HTMLAnchorElement
    const offered: Array<string> = []
    link.addEventListener("pointerdown", guardOwnedRoute)
    const stop = whenOwnedRouteIsOffered(document, (kind, route) =>
      offered.push(`${kind}:${route}`)
    )

    link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    await Promise.resolve()

    expect(offered).toEqual([])
    stop()
    bar.remove()
  })

  test("offers an extension link through the shared document", async () => {
    const root = document.createElement("div")
    root.id = "gitquiet-root"
    root.innerHTML = '<a href="/owner/repo/issues">Issues</a>'
    document.body.append(root)
    const link = root.querySelector("a") as HTMLAnchorElement
    const offered: Array<string> = []
    link.addEventListener("pointerdown", guardOwnedRoute)
    const stop = whenOwnedRouteIsOffered(document, (kind, route) =>
      offered.push(`${kind}:${route}`)
    )

    link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    await Promise.resolve()

    expect(offered).toEqual(["press:/owner/repo/issues"])
    stop()
    root.remove()
  })

  test("stops one duplicate popstate and leaves the next one alone", () => {
    const target = new EventTarget()
    const arm = suppressNextEvent(target, "popstate")
    let handled = 0
    target.addEventListener("popstate", () => handled++)

    arm()
    target.dispatchEvent(new Event("popstate"))
    target.dispatchEvent(new Event("popstate"))

    expect(handled).toBe(1)
  })

  test("keeps GitHub out of a prepared history traversal", async () => {
    markPreparedTraversal(document, "/owner/repo/pull/12?tab=files")
    let stopped = false
    let offered: string | null = null
    const stop = whenPreparedTraversalIsOffered(document, (route) => {
      offered = route
    })
    const event = {
      navigationType: "traverse",
      destination: {
        url: `${window.location.origin}/owner/repo/pull/12?tab=files`,
        sameDocument: true
      },
      stopImmediatePropagation: () => {
        stopped = true
      }
    } as unknown as Event

    expect(guardPreparedTraversal(event, document)).toBe(true)
    await Promise.resolve()
    expect(offered as unknown).toBe("/owner/repo/pull/12?tab=files")
    expect(stopped).toBe(true)
    expect(document.documentElement.hasAttribute(PREPARED_TRAVERSAL_ROUTE)).toBe(false)
    expect(preparedTraversal(document)).toBeNull()
    stop()
  })

  test("cancels a duplicate document navigation but keeps the history push", () => {
    let documentLoadCancelled = false
    let documentLoadStopped = false
    const documentLoad = {
      cancelable: true,
      destination: {
        url: `${window.location.origin}/owner/repo/pull/12`,
        sameDocument: false
      },
      preventDefault: () => {
        documentLoadCancelled = true
      },
      stopImmediatePropagation: () => {
        documentLoadStopped = true
      }
    }
    let pushCancelled = false
    const push = {
      ...documentLoad,
      destination: { ...documentLoad.destination, sameDocument: true },
      preventDefault: () => {
        pushCancelled = true
      }
    }

    expect(guardDuplicateNavigation("/owner/repo/pull/12", push)).toBe(false)
    expect(guardDuplicateNavigation("/owner/repo/pull/12", documentLoad)).toBe(true)
    expect(pushCancelled).toBe(false)
    expect(documentLoadCancelled).toBe(true)
    expect(documentLoadStopped).toBe(true)
  })

  test("cancels a push that repeats the address already shown", () => {
    window.history.replaceState(null, "", "/owner/repo/pull/12")
    let cancelled = false
    let stopped = false
    const echo = {
      cancelable: true,
      navigationType: "push",
      destination: {
        url: `${window.location.origin}/owner/repo/pull/12`,
        sameDocument: true
      },
      preventDefault: () => {
        cancelled = true
      },
      stopImmediatePropagation: () => {
        stopped = true
      }
    }

    expect(guardDuplicateNavigation("/owner/repo/pull/12", echo)).toBe(true)
    expect(cancelled).toBe(true)
    expect(stopped).toBe(true)
    window.history.replaceState(null, "", "/")
  })

  test("leaves a traversal to the address already shown alone", () => {
    window.history.replaceState(null, "", "/owner/repo/pull/12")
    let cancelled = false
    const back = {
      cancelable: true,
      navigationType: "traverse",
      destination: {
        url: `${window.location.origin}/owner/repo/pull/12`,
        sameDocument: true
      },
      preventDefault: () => {
        cancelled = true
      },
      stopImmediatePropagation: () => {}
    }

    expect(guardDuplicateNavigation("/owner/repo/pull/12", back)).toBe(false)
    expect(cancelled).toBe(false)
    window.history.replaceState(null, "", "/")
  })

  test("offers an interface link to the extension before GitHub sees the press", async () => {
    const root = document.createElement("div")
    root.id = "gitquiet-root"
    root.innerHTML = '<a href="/owner/repo/pull/12"><span>Pull request 12</span></a>'
    document.body.append(root)
    const link = root.querySelector("a") as HTMLAnchorElement
    const offered: Array<string> = []
    let githubRan = false
    const stop = whenOwnedRouteIsOffered(document, (kind, route) =>
      offered.push(`${kind}:${route}`)
    )
    link.addEventListener("pointerdown", guardOwnedRoute)
    link.addEventListener("pointerdown", () => {
      githubRan = true
    })

    link.querySelector("span")?.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 })
    )
    await Promise.resolve()

    expect(offered).toEqual(["press:/owner/repo/pull/12"])
    expect(githubRan).toBe(false)
    stop()
    root.remove()
  })

  test("cancels GitHub's listener and sends the route to the extension world", async () => {
    const link = document.createElement("a")
    link.href = "/owner/repo/pull/12"
    link.innerHTML = "<span>Pull request 12</span>"
    document.body.append(link)
    markOwnedRoute(link)
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    const routed: Array<string> = []
    let githubRan = false
    const stop = whenOwnedRouteIsOffered(document, (kind, route) =>
      routed.push(`${kind}:${route}`)
    )
    let githubReleased = false
    link.addEventListener("pointerup", guardOwnedRoute)
    link.addEventListener("pointerup", () => {
      githubReleased = true
    })
    link.addEventListener("click", guardOwnedRoute)
    link.addEventListener("click", () => {
      githubRan = true
    })

    link.querySelector("span")?.dispatchEvent(
      new MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0 })
    )
    expect(githubReleased).toBe(false)
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")

    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    link.querySelector("span")?.dispatchEvent(click)
    await Promise.resolve()

    expect(click.defaultPrevented).toBe(true)
    expect(githubRan).toBe(false)
    expect(routed).toEqual(["click:/owner/repo/pull/12"])
    expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
    await new Promise((done) => setTimeout(done, 0))
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    stop()
    link.remove()
  })

  test("leaves a modified click to the browser", () => {
    const link = document.createElement("a")
    document.body.append(link)
    link.href = "/owner/repo/pull/12"
    markOwnedRoute(link)
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true
    })
    Object.defineProperty(click, "target", { value: link })
    guardOwnedRoute(click)

    expect(click.defaultPrevented).toBe(false)
    expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    link.remove()
  })
})

/**
 * Both halves of the shadow boundary, which broke as a pair and hid each other.
 *
 * The interface stands in one shadow root. A press inside it is retargeted, so
 * every handler listening on `window` was told the press landed on the host and
 * `target.closest("a")` answered null for every link the interface draws — the
 * guard went blind the moment the interface moved, silently, because a handler
 * that finds no link politely does nothing.
 *
 * And the other half: `MutationObserver` does not cross a shadow boundary
 * either, so an offer written onto one of our links could not be heard by the
 * extension world that acts on it.
 *
 * Each fault hid the other. Fixing the seeing alone is worse than neither: the
 * guard then claims a press, cancels it, and drops it — measured on a real
 * repository's pull requests as a row that could be pressed and did nothing,
 * where before the press had worked. So they are tested together, and the live
 * probe checked the pair on github.com before this was written.
 */
describe("a press that happens inside our shadow root", () => {
  const withShadow = (): { page: Document; link: HTMLAnchorElement; host: HTMLElement } => {
    const page = document.implementation.createHTMLDocument("github")
    const host = page.createElement("div")
    host.id = "gitquiet-host"
    page.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    const link = page.createElement("a")
    link.setAttribute("href", "/owner/repo/pull/7")
    shadow.append(link)
    return { page, link, host }
  }

  test("is found through the composed path, where `target` cannot see it", () => {
    const { link, host } = withShadow()

    // What a listener on `window` is handed: the host, never the anchor.
    const asRetargeted = { composedPath: () => [link, host], target: host } as unknown as Event
    expect(host.closest("a")).toBeNull()
    expect(pressedLink(asRetargeted)).toBe(link)
  })

  test("and by the target, for an event that carries no composed path", () => {
    // A synthetic event, which is what a test dispatches and what some older
    // engines hand over. The fallback is what keeps those working.
    const page = document.implementation.createHTMLDocument("github")
    const link = page.createElement("a")
    link.setAttribute("href", "/owner/repo/pull/7")
    const inner = page.createElement("span")
    link.append(inner)
    page.body.append(link)

    const plain = { composedPath: () => [], target: inner } as unknown as Event
    expect(pressedLink(plain)).toBe(link)
  })

  test("nothing at all where the press was not on a link", () => {
    const page = document.implementation.createHTMLDocument("github")
    const plain = { composedPath: () => [page.body], target: page.body } as unknown as Event
    expect(pressedLink(plain)).toBeNull()
  })

  test("and an offer written on a link in there is heard", async () => {
    /*
     * The half that would otherwise go missing. `subtree` does not cross a
     * shadow boundary, so an observer on `documentElement` hears nothing that
     * happens in our tree — and the guard's claim would be cancelled and then
     * dropped.
     */
    const { page, link } = withShadow()
    const heard: Array<string> = []
    const stop = whenOwnedRouteIsOffered(page, (kind, route) => heard.push(`${kind} ${route}`))

    link.setAttribute("data-gitquiet-owned-route-offer-path", "/owner/repo/pull/7")
    link.setAttribute("data-gitquiet-owned-route-offer", "click")
    await new Promise((resume) => setTimeout(resume, 0))
    stop()

    expect(heard).toEqual(["click /owner/repo/pull/7"])
  })

  test("and so is one on a link that was never in our tree", async () => {
    // The document half still works: this watches both trees, not one instead
    // of the other.
    const page = document.implementation.createHTMLDocument("github")
    const link = page.createElement("a")
    link.setAttribute("href", "/owner/repo/pull/9")
    page.body.append(link)
    const heard: Array<string> = []
    const stop = whenOwnedRouteIsOffered(page, (kind, route) => heard.push(`${kind} ${route}`))

    link.setAttribute("data-gitquiet-owned-route-offer-path", "/owner/repo/pull/9")
    link.setAttribute("data-gitquiet-owned-route-offer", "press")
    await new Promise((resume) => setTimeout(resume, 0))
    stop()

    expect(heard).toEqual(["press /owner/repo/pull/9"])
  })

  test("and a tree that stands up after the watch began is watched too", async () => {
    /*
     * The order this actually happens in: a content script asks to hear offers
     * at `document_start`, and the interface stands its host up later. A watch
     * taken only at the start would hear nothing for the whole life of the page.
     */
    const page = document.implementation.createHTMLDocument("github")
    const heard: Array<string> = []
    const stop = whenOwnedRouteIsOffered(page, (kind, route) => heard.push(`${kind} ${route}`))

    const host = page.createElement("div")
    host.id = "gitquiet-host"
    page.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    await new Promise((resume) => setTimeout(resume, 0))

    const link = page.createElement("a")
    link.setAttribute("href", "/owner/repo/pull/11")
    shadow.append(link)
    link.setAttribute("data-gitquiet-owned-route-offer-path", "/owner/repo/pull/11")
    link.setAttribute("data-gitquiet-owned-route-offer", "click")
    await new Promise((resume) => setTimeout(resume, 0))
    stop()

    expect(heard).toEqual(["click /owner/repo/pull/11"])
  })

  test("names the same host the interface actually stands on", () => {
    // The id is spelled in `navigationGuard` rather than imported, to keep
    // Effect and the whole of `mount` out of the page-world bundle. This is what
    // stops the two spellings drifting apart.
    expect(HOST_ID).toBe("gitquiet-host")
  })
})
