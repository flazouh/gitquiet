import { describe, expect, test } from "bun:test"
import { SWITCH_ID, offerOurPage } from "./theirTabs"

/**
 * Their tab row as GitHub ships it: a nav wrapped around a flex strip of
 * links, the current one carrying `selected` in a class name that also
 * carries a per-deploy hash.
 */
const TABS = `
  <nav aria-label="Pull request navigation tabs">
    <div class="prc-TabNav-TabNavTabList-Ave63">
      <a class="TabNav-item prc-TabNav-TabNavLink-u3umI selected" href="/o/r/pull/1">Conversation</a>
      <a class="TabNav-item prc-TabNav-TabNavLink-u3umI" href="/o/r/pull/1/files">Files changed</a>
    </div>
  </nav>`

/** The same row, were they ever to build it out of a list. */
const LISTED = `
  <nav aria-label="Pull request navigation tabs">
    <ul class="prc-TabNav-TabNavTabList-Ave63">
      <li class="prc-TabNav-Item-9sQ2z"><a class="tab selected" href="/o/r/pull/1">Conversation</a></li>
      <li class="prc-TabNav-Item-9sQ2z"><a class="tab" href="/o/r/pull/1/files">Files changed</a></li>
    </ul>
  </nav>`

const githubPage = (tabs = TABS): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div id="repo-content-pjax-container">
      <react-app app-name="pull-requests">
        <header class="prc-PageLayout-Header-0of-R">${tabs}</header>
      </react-app>
    </div>`
  return page
}

const switchIn = (page: Document) => page.getElementById(SWITCH_ID)
const rowIn = (page: Document) => page.querySelector('[aria-label="Pull request navigation tabs"]')
const stripIn = (page: Document) => page.querySelector('[class*="TabNavTabList"]')!
const settle = () => new Promise((wake) => setTimeout(wake, 20))

describe("the way back to our page, on GitHub's own tab row", () => {
  test("goes inside the strip the tabs are in, not the row around it", () => {
    // Appended to the nav it lands on a line of its own underneath their tabs,
    // which is what this looked like on the real page before it was measured.
    const page = githubPage()

    offerOurPage(page, () => {})

    expect(switchIn(page)!.parentElement === stripIn(page)).toBe(true)
    expect(stripIn(page).lastElementChild).toBe(switchIn(page))
  })

  test("is dressed as the page's action, not as a fifth tab", () => {
    // A tab takes you to another part of what you are reading. This offers a
    // different reading of all of it, and blending into their row was how it
    // went unnoticed.
    const page = githubPage()

    offerOurPage(page, () => {})

    const dressed = switchIn(page)!.getAttribute("style")!
    expect(switchIn(page)!.className).toBe("")
    expect(dressed).toContain("button-primary-bgColor-rest")
    expect(dressed).toContain("font-weight: 600")
    expect(dressed).toContain("border-radius")
  })

  test("carries a mark as well as a word", () => {
    const page = githubPage()

    offerOurPage(page, () => {})

    expect(switchIn(page)!.querySelector("svg")).not.toBeNull()
    expect(switchIn(page)!.textContent).toContain("Enhanced view")
  })

  test("answers the pointer, which a class would have done for it", () => {
    const page = githubPage()
    offerOurPage(page, () => {})
    const control = switchIn(page)!
    const resting = control.getAttribute("style")!

    control.dispatchEvent(new Event("mouseenter"))
    const lit = control.getAttribute("style")!
    control.dispatchEvent(new Event("mouseleave"))

    expect(lit).toContain("button-primary-bgColor-hover")
    expect(lit).not.toBe(resting)
    expect(control.getAttribute("style")).toBe(resting)
  })

  test("stands clear of their last tab rather than touching it", () => {
    const page = githubPage()

    offerOurPage(page, () => {})

    const dressed = switchIn(page)!.getAttribute("style")!
    expect(dressed).toContain("margin: 0 0 0 12px")
    // Their tabs are the full height of the strip; a pill that stretched to
    // meet them would stop reading as a button.
    expect(dressed).toContain("align-self: center")
  })

  test("takes an item of its own when their tabs are a list", () => {
    const page = githubPage(LISTED)

    offerOurPage(page, () => {})

    const item = switchIn(page)!.parentElement!
    expect(item.tagName).toBe("LI")
    expect(item.className).toBe("prc-TabNav-Item-9sQ2z")
  })

  test("hands the page over when it is pressed", () => {
    const page = githubPage()
    let asked = 0

    offerOurPage(page, () => {
      asked += 1
    })
    switchIn(page)!.dispatchEvent(new Event("click", { bubbles: true }))

    expect(asked).toBe(1)
  })

  test("waits for a row GitHub has not rendered yet", async () => {
    const page = githubPage("")

    offerOurPage(page, () => {})
    expect(switchIn(page)).toBeNull()

    page.querySelector("header")!.innerHTML = TABS
    await settle()

    expect(switchIn(page)).not.toBeNull()
  })

  test("puts itself back when React throws the row away and builds another", async () => {
    const page = githubPage()
    offerOurPage(page, () => {})
    expect(switchIn(page)).not.toBeNull()

    page.querySelector("header")!.innerHTML = TABS
    await settle()

    expect(switchIn(page)).not.toBeNull()
    expect(page.querySelectorAll(`#${SWITCH_ID}`).length).toBe(1)
  })

  test("is only ever one of them, however much the page churns", async () => {
    const page = githubPage()
    offerOurPage(page, () => {})

    for (let i = 0; i < 3; i += 1) {
      rowIn(page)!.appendChild(page.createElement("span"))
    }
    await settle()

    expect(page.querySelectorAll(`#${SWITCH_ID}`).length).toBe(1)
  })

  test("leaves their row exactly as it was found when it is taken away", async () => {
    const page = githubPage()
    const stop = offerOurPage(page, () => {})

    stop()

    expect(switchIn(page)).toBeNull()
    expect(stripIn(page).children.length).toBe(2)

    // And stays away: an observer still running would put it back on the next
    // thing React does, over an interface that has just taken the page.
    page.querySelector("header")!.innerHTML = TABS
    await settle()
    expect(switchIn(page)).toBeNull()
  })
})
