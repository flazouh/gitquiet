import { describe, expect, test } from "bun:test"
import {
  ROOT_ID,
  findConversationSlot,
  findSlot,
  gate,
  interfaceContainer,
  reveal,
  takeOverSlot,
  takeOverSlotWhenReady
} from "./mount"

/** GitHub's pull request page, down to the parts this depends on. */
const githubPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div class="header-wrapper"><header>site nav</header></div>
    <div id="repo-content-pjax-container">
      <react-app app-name="pull-requests">
        <div class="prc-PageLayout-PageLayoutWrapper-2BhU2">
          <header class="prc-PageLayout-Header-0of-R">
            title and state
            <nav aria-label="Pull request navigation tabs">Conversation Commits Checks Files changed</nav>
          </header>
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
const theirTabsIn = (page: Document) =>
  page.querySelector('[aria-label="Pull request navigation tabs"]')!

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

  test("hides their pull request tabs, since ours answers the same question", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(theirTabsIn(page).hasAttribute("hidden")).toBe(true)
    // Only the tabs. The title and state above them are how someone knows
    // which pull request this is, and they stay.
    expect(page.querySelector('[class*="PageLayout-Header"]')?.hasAttribute("hidden")).toBe(false)
  })

  test("gives their tabs back when it steps aside", () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()

    expect(theirTabsIn(page).hasAttribute("hidden")).toBe(false)
  })

  test("hides their tabs again when React draws them a second time", async () => {
    const page = githubPage()
    takeOverSlot(page)
    theirTabsIn(page).remove()

    const again = page.createElement("nav")
    again.setAttribute("aria-label", "Pull request navigation tabs")
    page.querySelector('[class*="PageLayout-Header"]')!.append(again)
    await Promise.resolve()

    expect(again.hasAttribute("hidden")).toBe(true)
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

  test("a second takeover adopts the interface already there rather than hiding it", () => {
    const page = githubPage()
    const first = takeOverSlot(page)
    first!.container.textContent = "our interface"

    const second = takeOverSlot(page)

    expect(page.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1)
    expect(second?.container).toBe(first!.container)
    expect(first!.container.hasAttribute("hidden")).toBe(false)
    expect(second?.container.textContent).toBe("our interface")
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

    const waiting = takeOverSlotWhenReady(page, interfaceContainer(page), 1000)
    const late = page.createElement("div")
    late.className = "prc-PageLayout-PageLayoutContent-BneH9"
    page.querySelector("#repo-content-pjax-container")!.append(late)

    expect((await waiting)?.container.id).toBe(ROOT_ID)
    expect(late.querySelector(`#${ROOT_ID}`)).not.toBeNull()
  })

  test("gives up rather than waiting forever on a page that has none", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    expect(await takeOverSlotWhenReady(page, interfaceContainer(page), 10)).toBeNull()
  })

  test("renders into the container it was given rather than making a second one", async () => {
    const page = githubPage()
    // What the content script does: builds the interface before the region it
    // belongs in has been parsed, then hands that exact element over.
    const early = interfaceContainer(page)
    early.textContent = "our interface"

    await takeOverSlotWhenReady(page, early, 1000)

    expect(page.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1)
    expect(slotOf(page).querySelector(`#${ROOT_ID}`)).toBe(early)
    expect(early.textContent).toBe("our interface")
  })
})

describe("choosing between the conversation and the whole repository content", () => {
  const onlyTheContainer = (): Document => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = '<div id="repo-content-pjax-container">everything</div>'
    return page
  }

  test("will not settle for the whole content while the conversation may still be parsed", () => {
    // `#repo-content-pjax-container` is far higher up GitHub's document than the
    // region inside it, so during parsing it is always the one that exists. At
    // `document_start` that made the fallback the normal path, and the
    // interface took the entire repository content on every load.
    expect(findConversationSlot(onlyTheContainer())).toBeNull()
  })

  test("takes the whole content once it is clear there is no conversation region", () => {
    const page = onlyTheContainer()

    expect(findSlot(page)).toBe(page.querySelector("#repo-content-pjax-container"))
  })

  test("prefers the conversation to the content that holds it", () => {
    const page = githubPage()

    expect(findConversationSlot(page)).toBe(slotOf(page))
    expect(findSlot(page)).toBe(slotOf(page))
  })
})

/**
 * The gate belonging to the script that runs on every GitHub page, which holds
 * the conversation back while the interface is still being injected into a page
 * that was never loaded as a pull request.
 */
const GATING = "data-githubpro-gating"

describe("arriving after the document has finished, which is what a soft navigation is", () => {
  /** The list of pull requests, finished loading, with no conversation on it yet. */
  const aFinishedPage = (): Document => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = `<div id="repo-content-pjax-container">the list of pull requests</div>`
    return page
  }

  test("waits for the conversation instead of seizing the whole repository content", async () => {
    // The old test was whether the document had finished parsing. On a soft
    // navigation it finished long ago, as somebody's list — so that test passed
    // instantly and the interface took the container Turbo is about to replace,
    // which took the interface with it and left the page blank.
    const page = aFinishedPage()

    const waiting = takeOverSlotWhenReady(page, interfaceContainer(page), 200, 100)
    page.body.innerHTML = `
      <div id="repo-content-pjax-container">
        <react-app app-name="pull-requests">
          <div class="prc-PageLayout-PageLayoutContent-BneH9">GitHub's conversation</div>
        </react-app>
      </div>`

    const takeover = await waiting

    expect(takeover).not.toBeNull()
    expect(takeover!.container.parentElement === slotOf(page)).toBe(true)
  })

  test("still takes the whole content once the conversation is plainly not coming", async () => {
    const page = aFinishedPage()

    const takeover = await takeOverSlotWhenReady(page, interfaceContainer(page), 400, 20)

    expect(takeover).not.toBeNull()
    expect(takeover!.container.parentElement).toBe(
      page.querySelector("#repo-content-pjax-container")
    )
  })

  test("moves into the conversation region if GitHub renders one late", async () => {
    // The short wait means a slow page is taken over at the whole repository
    // content, which is quick but not where the interface belongs. When the
    // conversation finally appears, the interface should go into it.
    const page = aFinishedPage()
    const takeover = await takeOverSlotWhenReady(page, interfaceContainer(page), 400, 20)
    expect(takeover!.container.parentElement!.id).toBe("repo-content-pjax-container")

    page.querySelector("#repo-content-pjax-container")!.insertAdjacentHTML(
      "afterbegin",
      `<react-app app-name="pull-requests">
         <div class="prc-PageLayout-PageLayoutContent-BneH9">GitHub's conversation</div>
       </react-app>`
    )
    await new Promise((wake) => setTimeout(wake, 20))

    expect(takeover!.container.parentElement === slotOf(page)).toBe(true)
  })

  test("keeps watching from the body, which Turbo does not replace", async () => {
    const page = aFinishedPage()
    const takeover = await takeOverSlotWhenReady(page, interfaceContainer(page), 400, 20)

    // Turbo swapping the frame out from under the interface. Anything watching
    // that frame is now watching a node off the page and will never fire again.
    page.body.innerHTML = `
      <div id="repo-content-pjax-container">
        <react-app app-name="pull-requests">
          <div class="prc-PageLayout-PageLayoutContent-BneH9">a different pull request</div>
        </react-app>
      </div>`
    await new Promise((wake) => setTimeout(wake, 20))

    expect(takeover!.container.isConnected).toBe(true)
    expect(page.documentElement.hasAttribute("data-githubpro-taken")).toBe(true)
  })
})

describe("the two gates, which are not the same gate", () => {
  test("revealing does not lift the other script's gate", () => {
    // The interface is injected mid-navigation, while the address still says
    // the list being left. It reveals — its own stylesheet came with it and
    // would hide the list — and if that also lifted this gate, GitHub's
    // conversation would paint in the moment before the takeover.
    const page = githubPage()
    page.documentElement.setAttribute(GATING, "")

    reveal(page)

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(true)
    expect(page.documentElement.hasAttribute(GATING)).toBe(true)
  })

  test("lifts it once the interface is actually in front of their conversation", () => {
    const page = githubPage()
    page.documentElement.setAttribute(GATING, "")

    takeOverSlot(page)

    expect(page.documentElement.hasAttribute(GATING)).toBe(false)
  })

  test("lifts it when it gives up, so the page is never left blank", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"
    page.documentElement.setAttribute(GATING, "")

    await takeOverSlotWhenReady(page, interfaceContainer(page), 10)

    expect(page.documentElement.hasAttribute(GATING)).toBe(false)
  })

  test("gating again for the next pull request undoes the reveal", () => {
    const page = githubPage()
    takeOverSlot(page)

    gate(page)

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(false)
    expect(page.documentElement.hasAttribute(GATING)).toBe(true)
  })
})

describe("keeping GitHub's own pull request off the screen until ours is up", () => {
  test("the page starts gated, so their server-rendered conversation never paints", () => {
    const page = githubPage()

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(false)
  })

  test("reveals only once their conversation is hidden behind ours", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(true)
    expect(theirsIn(page).hasAttribute("hidden")).toBe(true)
  })

  test("reveals when it gives up, rather than leaving a page nothing will ever show", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    await takeOverSlotWhenReady(page, interfaceContainer(page), 10)

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(true)
  })

  test("says it is in charge, so the rule hiding their conversation applies", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(page.documentElement.hasAttribute("data-githubpro-taken")).toBe(true)
  })

  test("is not in charge of a page it gave up on, so theirs is what shows", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    await takeOverSlotWhenReady(page, interfaceContainer(page), 10)

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(true)
    expect(page.documentElement.hasAttribute("data-githubpro-taken")).toBe(false)
  })

  test("gives up being in charge when it steps aside", () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()

    expect(page.documentElement.hasAttribute("data-githubpro-taken")).toBe(false)
  })

  test("leaves the page revealed when it steps aside", () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()

    expect(page.documentElement.hasAttribute("data-githubpro-revealed")).toBe(true)
    expect(theirsIn(page).hasAttribute("hidden")).toBe(false)
  })
})
