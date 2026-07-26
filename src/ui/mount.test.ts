import { describe, expect, test } from "bun:test"
import { ROOT_ID, findSlot, takeOverSlot, takeOverSlotWhenReady } from "./mount"

/** GitHub's pull request page, down to the parts this depends on. */
const githubPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div class="header-wrapper"><header>site nav</header></div>
    <div id="repo-content-pjax-container">
      <react-app app-name="pull-requests">
        <div class="prc-PageLayout-PageLayoutWrapper-2BhU2">
          <header class="prc-PageLayout-Header-0of-R">title, state and tabs</header>
          <div class="prc-PageLayout-PageLayoutContent-BneH9">
            <div class="js-updatable-content">GitHub's conversation</div>
          </div>
        </div>
      </react-app>
    </div>`
  return page
}

const slotOf = (page: Document) => page.querySelector('[class*="PageLayoutContent"]')!
const theirsIn = (page: Document) => page.querySelector(".js-updatable-content")!

describe("slotting into GitHub's pull request page", () => {
  test("finds the region GitHub fills with the conversation", () => {
    const page = githubPage()

    expect(findSlot(page)).toBe(slotOf(page))
  })

  test("leaves the page's own header and navigation alone", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(page.querySelector(".header-wrapper")?.textContent).toContain("site nav")
    expect(page.querySelector('[class*="PageLayout-Header"]')?.hasAttribute("hidden")).toBe(false)
  })

  test("hides GitHub's conversation rather than deleting it out from under React", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(theirsIn(page).hasAttribute("hidden")).toBe(true)
  })

  test("hands back a container already mounted in the slot", () => {
    const page = githubPage()

    const takeover = takeOverSlot(page)
    takeover!.container.textContent = "our interface"

    expect(takeover!.container.id).toBe(ROOT_ID)
    expect(slotOf(page).querySelector(`#${ROOT_ID}`)?.textContent).toBe("our interface")
  })

  test("hides whatever GitHub renders into the slot afterwards", async () => {
    const page = githubPage()
    takeOverSlot(page)

    const late = page.createElement("div")
    late.textContent = "a live update"
    slotOf(page).append(late)
    await Promise.resolve()

    expect(late.hasAttribute("hidden")).toBe(true)
  })

  test("puts the interface back if a re-render takes it out", async () => {
    const page = githubPage()
    takeOverSlot(page)

    page.getElementById(ROOT_ID)?.remove()
    slotOf(page).append(page.createElement("div"))
    await Promise.resolve()

    expect(slotOf(page).querySelector(`#${ROOT_ID}`)).not.toBeNull()
  })

  test("follows the region to its replacement when React swaps the whole thing out", async () => {
    const page = githubPage()
    takeOverSlot(page)
    const wrapper = page.querySelector('[class*="PageLayoutWrapper"]')!

    // What GitHub's React actually does on a re-render: not update the region,
    // replace it. Our container leaves the page attached to the discarded one.
    slotOf(page).remove()
    const replacement = page.createElement("div")
    replacement.className = "prc-PageLayout-PageLayoutContent-BneH9"
    replacement.innerHTML = '<div class="js-updatable-content">their conversation, again</div>'
    wrapper.append(replacement)
    await Promise.resolve()

    expect(replacement.querySelector(`#${ROOT_ID}`)).not.toBeNull()
    expect(replacement.querySelector(".js-updatable-content")?.hasAttribute("hidden")).toBe(true)
  })

  test("gives the conversation back when it steps aside", async () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()
    slotOf(page).append(page.createElement("div"))
    await Promise.resolve()

    expect(theirsIn(page).hasAttribute("hidden")).toBe(false)
    expect(page.getElementById(ROOT_ID)).toBeNull()
  })

  test("declines rather than guessing when GitHub's layout has moved", () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    expect(takeOverSlot(page)).toBeNull()
  })
})

describe("arriving before GitHub has rendered", () => {
  test("waits for the region, which React only draws after the document is done", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = '<div id="repo-content-pjax-container"></div>'

    const waiting = takeOverSlotWhenReady(page, 1000)
    const late = page.createElement("div")
    late.className = "prc-PageLayout-PageLayoutContent-BneH9"
    page.querySelector("#repo-content-pjax-container")!.append(late)

    expect((await waiting)?.container.id).toBe(ROOT_ID)
    expect(late.querySelector(`#${ROOT_ID}`)).not.toBeNull()
  })

  test("gives up rather than waiting forever on a page that has none", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    expect(await takeOverSlotWhenReady(page, 10)).toBeNull()
  })
})
