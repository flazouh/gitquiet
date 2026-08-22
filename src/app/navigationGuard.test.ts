import { describe, expect, test } from "bun:test"
import {
  guardOwnedRoute,
  guardDuplicateNavigation,
  markOwnedRoute,
  OWNED_ROUTE,
  OWNED_ROUTE_CLICK,
  OWNED_ROUTE_PRESS,
  OWNED_TRAVERSAL,
  PREPARED_TRAVERSAL_ROUTE,
  guardPreparedTraversal,
  suppressNextEvent
} from "./navigationGuard"

describe("the page-world guard for an owned route", () => {
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

  test("keeps GitHub out of a prepared history traversal", () => {
    document.documentElement.setAttribute(
      PREPARED_TRAVERSAL_ROUTE,
      "/owner/repo/pull/12?tab=files"
    )
    let stopped = false
    let offered: string | null = null
    document.addEventListener(
      OWNED_TRAVERSAL,
      (event) => {
        offered = (event as CustomEvent<string>).detail
      },
      { once: true }
    )
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
    expect(offered as unknown).toBe("/owner/repo/pull/12?tab=files")
    expect(stopped).toBe(true)
    expect(document.documentElement.hasAttribute(PREPARED_TRAVERSAL_ROUTE)).toBe(false)
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

  test("offers an interface link to the extension before GitHub sees the press", () => {
    const root = document.createElement("div")
    root.id = "gitquiet-root"
    root.innerHTML = '<a href="/owner/repo/pull/12"><span>Pull request 12</span></a>'
    document.body.append(root)
    const link = root.querySelector("a") as HTMLAnchorElement
    let offered = 0
    let githubRan = false
    link.addEventListener(OWNED_ROUTE_PRESS, () => offered++)
    link.addEventListener("pointerdown", guardOwnedRoute)
    link.addEventListener("pointerdown", () => {
      githubRan = true
    })

    link.querySelector("span")?.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 })
    )

    expect(offered).toBe(1)
    expect(githubRan).toBe(false)
    root.remove()
  })

  test("cancels GitHub's listener and sends the route to the extension world", async () => {
    const link = document.createElement("a")
    link.href = "/owner/repo/pull/12"
    link.innerHTML = "<span>Pull request 12</span>"
    document.body.append(link)
    markOwnedRoute(link)
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    let routed = 0
    let githubRan = false
    link.addEventListener(OWNED_ROUTE_CLICK, () => routed++)
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

    expect(click.defaultPrevented).toBe(true)
    expect(githubRan).toBe(false)
    expect(routed).toBe(1)
    expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
    await new Promise((done) => setTimeout(done, 0))
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    link.remove()
  })

  test("leaves a modified click to the browser", () => {
    const link = document.createElement("a")
    document.body.append(link)
    link.href = "/owner/repo/pull/12"
    markOwnedRoute(link)
    let routed = 0
    link.addEventListener(OWNED_ROUTE_CLICK, () => routed++)

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true
    })
    Object.defineProperty(click, "target", { value: link })
    guardOwnedRoute(click)

    expect(click.defaultPrevented).toBe(false)
    expect(routed).toBe(0)
    expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
    expect(link.getAttribute("href")).toBe("/owner/repo/pull/12")
    link.remove()
  })
})
