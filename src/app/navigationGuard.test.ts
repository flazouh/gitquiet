import { describe, expect, test } from "bun:test"
import {
  guardOwnedRoute,
  guardDuplicateNavigation,
  markOwnedRoute,
  OWNED_ROUTE,
  guardPreparedTraversal,
  suppressNextEvent,
  whenOwnedRouteIsOffered
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
