import { describe, expect, test } from "bun:test"
import { coarsen, GateLeak, leaksIn } from "./gateAudit"
import type { Place } from "./place"

/**
 * Home as it stood before `plans/006-stand-on-the-body.md`, when its sidebar was a
 * named band. The live place stands on `body` now and carries no bands, so the audit
 * has nothing to say about it — this fixture keeps the Account-rename scenario the
 * audit exists for, for the places that still name what they hide.
 */
const BANDED: Place = {
  name: "home",
  owns: () => true,
  regions: ["#dashboard.dashboard"],
  fallback: "main.flex-1",
  bands: [
    "div.copilotPreview__container",
    'div.feed-background:has(#dashboard.dashboard) aside.feed-left-sidebar[aria-label="Dashboard menu"]'
  ]
}

/**
 * The home page down to the sidebar band and the column its `:has()` proves against.
 * `label` is the one thing GitHub reworded under the extension, so the fixture takes it
 * as an argument: the right label is the working page, the wrong one is the day the gate
 * went quiet.
 */
const homeWith = (label: string): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div class="application-main">
      <div class="d-md-flex feed-background">
        <aside class="feed-left-sidebar col-md-4 col-lg-3" aria-label="${label}">
          <nav>their repositories</nav>
        </aside>
        <div class="flex-auto">
          <div class="d-flex feed-content flex-column">
            <main class="flex-1">
              <div><div id="dashboard" class="dashboard"><div class="news">their modules</div></div></div>
            </main>
          </div>
        </div>
      </div>
    </div>`
  return page
}

/** In a browser a leak paints; jsdom has no layout, so a test says what is visible. */
const shown = (element: Element): boolean => !element.hasAttribute("hidden")

describe("coarsen strips what GitHub rewords and keeps what it does not", () => {
  test("drops the label and the :has guard, keeps the structural family", () => {
    expect(
      coarsen('div.feed-background:has(#dashboard.dashboard) aside.feed-left-sidebar[aria-label="Dashboard menu"]')
    ).toBe("div.feed-background aside.feed-left-sidebar")
  })

  test("leaves a selector with no reworded parts exactly as it is", () => {
    expect(coarsen("div.copilotPreview__container")).toBe("div.copilotPreview__container")
  })

  test("keeps a structural attribute while dropping a natural-language one", () => {
    expect(coarsen('turbo-frame#repo-content-turbo-frame[aria-label="x"]')).toBe(
      "turbo-frame#repo-content-turbo-frame"
    )
  })

  test("a compound that was only a label becomes a wildcard, not nothing", () => {
    expect(coarsen('main [aria-label="Explore"]')).toBe("main *")
  })
})

describe("leaksIn tells a stale band from a page that has moved on", () => {
  test("reports the sidebar when GitHub has reworded its label out from under the band", () => {
    const leaks = leaksIn(homeWith("Account"), BANDED, shown)

    expect(leaks).toHaveLength(1)
    expect(leaks[0]?.coarse).toBe("div.feed-background aside.feed-left-sidebar")
    expect(leaks[0]?.found).toBe("aside.feed-left-sidebar.col-md-4.col-lg-3")
  })

  test("says nothing while the band still matches the label it names", () => {
    expect(leaksIn(homeWith("Dashboard menu"), BANDED, shown)).toHaveLength(0)
  })

  test("says nothing when their sidebar is hidden, however it was hidden", () => {
    const page = homeWith("Account")
    page.querySelector("aside.feed-left-sidebar")?.setAttribute("hidden", "")

    expect(leaksIn(page, BANDED, shown)).toHaveLength(0)
  })

  test("says nothing on a page that has no sidebar at all", () => {
    const page = homeWith("Account")
    page.querySelector("aside.feed-left-sidebar")?.remove()

    expect(leaksIn(page, BANDED, shown)).toHaveLength(0)
  })
})

describe("the reported error is worded to group across a rename", () => {
  test("names the coarse family, never the value that changed", () => {
    const error = new GateLeak(BANDED.name, leaksIn(homeWith("Account"), BANDED, shown))

    expect(error.name).toBe("GateLeak")
    expect(error.message).toContain("div.feed-background aside.feed-left-sidebar")
    expect(error.message).not.toContain("Account")
  })
})
