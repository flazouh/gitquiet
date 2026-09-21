import { beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  GOING,
  ROOT_ID,
  gate,
  handBack,
  theirPageHidden,
  interfaceContainer,
  markPage,
  reveal,
  takeOverSlot,
  takeOverSlotWhenReady,
  theScreenArrived,
  theScreenIsAt,
  theScreenIsNotElsewhere,
  theScreenLeft,
  theScreenMoved,
  ungate,
  whenTheScreenMoves
} from "./mount"
import { ACTIONS, CONVERSATION, HOME, REPO_PULLS } from "./place"
import { letTheirStylesBack } from "./theHost"

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
            <nav aria-label="Pull request navigation">Conversation Commits Checks Files changed</nav>
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
/**
 * Our container, looked for where it actually stands.
 *
 * `document.getElementById` cannot see through a shadow boundary, and the
 * interface is inside one now. Every assertion about "the root on the page" goes
 * through this instead — the fact being asserted is unchanged, only where the
 * page keeps it.
 */
const ourRoot = (page: Document): HTMLElement | null =>
  (page.getElementById("gitquiet-host")?.shadowRoot ?? page).querySelector<HTMLElement>(`#${ROOT_ID}`)

/** Every container of ours on the page, for the tests that count them. */
const allRoots = (page: Document): ReadonlyArray<Element> => [
  ...(page.getElementById("gitquiet-host")?.shadowRoot ?? page).querySelectorAll(`#${ROOT_ID}`)
]

describe("arriving after the document has finished, which is what a soft navigation is", () => {
  /** The list of pull requests, finished loading, with no conversation on it yet. */
  const aFinishedPage = (): Document => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = `<div id="repo-content-pjax-container"><div class="js-updatable-content">the list of pull requests</div></div>`
    return page
  }




  test("keeps watching from the body, which Turbo does not replace", async () => {
    const page = aFinishedPage()
    const takeover = await Effect.runPromise(takeOverSlotWhenReady(page, interfaceContainer(page), 400, 20))

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
    expect(page.documentElement.hasAttribute("data-gitquiet-taken")).toBe(true)
  })

})

/** The mark the shell writes while it holds a page back, before a screen is up. */
const GATING = "data-gitquiet-gating"

describe("the two gates, which are not the same gate", () => {
  test("revealing does not lift the other script's gate", () => {
    // The interface is injected mid-navigation, while the address still says
    // the list being left. It reveals — its own stylesheet came with it and
    // would hide the list — and if that also lifted this gate, GitHub's
    // conversation would paint in the moment before the takeover.
    const page = githubPage()
    page.documentElement.setAttribute(GATING, "")

    reveal(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
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

    await Effect.runPromise(takeOverSlotWhenReady(page, interfaceContainer(page), 10))

    expect(page.documentElement.hasAttribute(GATING)).toBe(false)
  })

  test("gating again for the next pull request undoes the reveal", () => {
    const page = githubPage()
    takeOverSlot(page)

    gate(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(false)
    expect(page.documentElement.hasAttribute(GATING)).toBe(true)
  })
})

describe("one screen leaving while another arrives", () => {
  test("the screen leaving does not reveal over the one arriving", () => {
    /*
     * What a reader sees pressing Issues on a repository's pull request list.
     * The shell gates for the issues screen on the press; the list screen's own
     * watcher then fires with an address it does not own. Revealing there lifts
     * the rule that hides by default, and GitHub's own list paints for as long
     * as the arriving screen takes to mount — most of a second, on the
     * recording that found this.
     */
    const page = githubPage()
    takeOverSlot(page)
    gate(page)

    handBack(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(false)
    expect(page.documentElement.hasAttribute(GATING)).toBe(true)
  })

  test("the screen leaving does hand back where nobody else wants the page", () => {
    // The Code tab, or anything else this extension has no screen for. Nothing
    // is gating, so nothing else is coming, and a page left hidden is blank.
    const page = githubPage()
    takeOverSlot(page)

    handBack(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
  })

  test("a page handed back is shown, though it keeps its name", () => {
    /*
     * Found on github.com/login: a black page. The sign-on screen is started by a
     * root class GitHub puts on its login box as well as on an organisation's
     * wall, reads the page, finds no wall and hands it back — correctly. And the
     * reader saw nothing, because the rule hiding their page was keyed on the
     * name alone and a hand-back reveals without unnaming.
     *
     * The same for every hand-back: GitHub's own view chosen in the settings, a
     * screen that failed or gave up, a second factor, a device check, a gist.
     */
    const page = githubPage()
    markPage(page, CONVERSATION)
    expect(theirPageHidden(page)).toBe(true)

    handBack(page)

    expect(theirPageHidden(page)).toBe(false)
    expect(page.documentElement.getAttribute("data-gitquiet-page")).toBe("conversation")
  })

  test("stays hidden under a screen of ours, which reveals as it takes the page", () => {
    // A takeover reveals as well as taking, so revealed alone cannot be the test.
    const page = githubPage()
    markPage(page, CONVERSATION)

    takeOverSlot(page, interfaceContainer(page, CONVERSATION), CONVERSATION)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
    expect(theirPageHidden(page)).toBe(true)
  })

  test("stays hidden where another screen is arriving, since the page is that screen's", () => {
    const page = githubPage()
    markPage(page, CONVERSATION)
    gate(page)

    handBack(page)

    expect(theirPageHidden(page)).toBe(true)
  })

  test("is never hidden on a page that is not one of ours", () => {
    const page = githubPage()
    expect(theirPageHidden(page)).toBe(false)
  })

  test("is hidden again by a press from a page that was shown, until the press gives up", () => {
    /*
     * GitHub's Code tab is shown and keeps its name. A press into a pull request
     * gates; a gate that left the showing mark on hid nothing, and the page GitHub
     * drew for the new address was on the screen until ours stood on it. A press
     * that is never answered shows their page again, rather than a black one.
     */
    const page = githubPage()
    markPage(page, CONVERSATION)
    handBack(page)
    expect(theirPageHidden(page)).toBe(false)

    gate(page)
    expect(theirPageHidden(page)).toBe(true)

    ungate(page)
    reveal(page)
    expect(theirPageHidden(page)).toBe(false)
  })

  test("the screen arriving reveals for itself, so the page is never stuck", () => {
    // The other half of the first case: having not revealed on the way out,
    // something has to reveal on the way in, or the reader waits for the
    // failsafe over a page that has nothing on it.
    const page = githubPage()
    gate(page)
    handBack(page)

    takeOverSlot(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
    expect(page.documentElement.hasAttribute(GATING)).toBe(false)
  })
})

describe("keeping GitHub's own pull request off the screen until ours is up", () => {
  test("the page starts gated, so their server-rendered conversation never paints", () => {
    const page = githubPage()

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(false)
  })


  test("reveals when it gives up, rather than leaving a page nothing will ever show", async () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = "<div>something else entirely</div>"

    await Effect.runPromise(takeOverSlotWhenReady(page, interfaceContainer(page), 10))

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
  })

  test("says it is in charge, so the rule hiding their conversation applies", () => {
    const page = githubPage()

    takeOverSlot(page)

    expect(page.documentElement.hasAttribute("data-gitquiet-taken")).toBe(true)
  })


  test("gives up being in charge when it steps aside", () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()

    expect(page.documentElement.hasAttribute("data-gitquiet-taken")).toBe(false)
  })

  test("leaves the page revealed when it steps aside", () => {
    const page = githubPage()
    const takeover = takeOverSlot(page)

    takeover!.stepAside()

    expect(page.documentElement.hasAttribute("data-gitquiet-revealed")).toBe(true)
    expect(theirsIn(page).hasAttribute("hidden")).toBe(false)
  })
})

/**
 * Pressing a pull request on a list this extension drew, from the reader's side:
 * what is on the screen between the press and the card.
 *
 * The card is several hundred milliseconds away — its script has to be injected,
 * and it has a pull request to read — and for the whole of that time the list is
 * the page. Taking the list out any earlier than the moment the card is in the
 * document leaves a hole: nothing of ours, and GitHub's own page still held back
 * by the gate, which is the flash this arrangement exists to avoid.
 */
describe("handing the page from one interface to the next", () => {
  const listUp = (page: Document) =>
    takeOverSlot(page, interfaceContainer(page, REPO_PULLS), REPO_PULLS)!

  test("leaves the list on the screen while the card is still being built", () => {
    const page = githubPage()
    const list = listUp(page)

    interfaceContainer(page, CONVERSATION)

    expect(list.container.isConnected).toBe(true)
    expect<Element | null>(ourRoot(page)).toBe(list.container)
  })

  test("takes it out at the moment the card is put in the page, and not before", () => {
    const page = githubPage()
    const list = listUp(page)
    const arriving = interfaceContainer(page, CONVERSATION)

    const card = takeOverSlot(page, arriving, CONVERSATION)

    expect(list.container.isConnected).toBe(false)
    expect(allRoots(page)).toHaveLength(1)
    expect<Element | null>(ourRoot(page)).toBe(card!.container)
  })


  test("says whether the page went back to GitHub, which is what it was asked", () => {
    const page = githubPage()

    expect(takeOverSlot(page)!.stepAside()).toBe(true)
  })


  test("tells an interface it is off the page, so its own tree comes down with it", () => {
    // The only moment it is right to unmount: earlier empties what the reader is
    // looking at, later leaves a tree reading GitHub for a page nobody is on.
    const page = githubPage()
    const list = listUp(page)
    let down = 0
    let connectedWhenTold = true
    list.container.addEventListener(GOING, () => {
      down += 1
      connectedWhenTold = list.container.isConnected
    })

    takeOverSlot(page, interfaceContainer(page, CONVERSATION), CONVERSATION)

    expect(down).toBe(1)
    expect(connectedWhenTold).toBe(false)
  })

  test("tells it so even when their router took its container off the page first", () => {
    /*
     * The double bar. A Run stands inside `turbo-frame#repo-content-turbo-frame`
     * rather than in a container within it, and Turbo replaces that frame's
     * children wholesale on a navigation. So the interface being replaced can be
     * out of the document before the next one settles, and a search of the
     * document for it finds nothing: its tree stays mounted, reading GitHub for a
     * page nobody is on, and its bar is still in `#gitquiet-bar` beside the new
     * one.
     */
    const page = githubPage()
    const list = listUp(page)
    let down = 0
    list.container.addEventListener(GOING, () => {
      down += 1
    })

    const card = interfaceContainer(page, CONVERSATION)
    list.container.remove()
    takeOverSlot(page, card, CONVERSATION)

    expect(down).toBe(1)
  })

  test("tells it the same when it steps aside on its own account", () => {
    const page = githubPage()
    const alone = takeOverSlot(page)!
    let down = 0
    alone.container.addEventListener(GOING, () => {
      down += 1
    })

    alone.stepAside()

    expect(down).toBe(1)
  })

  /* Concurrent detached starts are reduced to one interface at takeover. */
  test("stands one interface where two were built before either had a page", () => {
    const page = githubPage()
    const first = interfaceContainer(page, REPO_PULLS)
    const second = interfaceContainer(page, REPO_PULLS)
    expect(second).not.toBe(first)

    takeOverSlot(page, first, REPO_PULLS)
    takeOverSlot(page, second, REPO_PULLS)

    expect(allRoots(page)).toHaveLength(1)
    expect<Element | null>(ourRoot(page)).toBe(second)
  })

  test("tells the one it sweeps that it is going, so that tree comes down too", () => {
    const page = githubPage()
    const first = interfaceContainer(page, REPO_PULLS)
    const second = interfaceContainer(page, REPO_PULLS)
    let down = 0
    first.addEventListener(GOING, () => {
      down += 1
    })

    takeOverSlot(page, first, REPO_PULLS)
    takeOverSlot(page, second, REPO_PULLS)

    expect(down).toBe(1)
  })

  test("the list does not put itself back once the card has the page", async () => {
    // Both takeovers are watching the document, and the list's sees its own
    // container leave. Putting it back would start a fight neither ever wins.
    const page = githubPage()
    const list = listUp(page)
    const card = takeOverSlot(page, interfaceContainer(page, CONVERSATION), CONVERSATION)!

    slotOf(page).append(page.createElement("div"))
    await Promise.resolve()

    expect(list.container.isConnected).toBe(false)
    expect<Element | null>(ourRoot(page)).toBe(card.container)
  })
})

/**
 * Pressing a pull request on the Working Set, which is the one handover where the
 * page being left has a layout of the same shape as the page being arrived at.
 *
 * Their dashboard is built out of the same Primer parts as their pull request:
 * a `PageLayoutRoot` holding a `PageLayoutContent`. So the card's own search
 * finds a region the instant it looks — a region belonging to the dashboard,
 * inside the very element the Working Set hid on its way in. Taking it swept the
 * Working Set off the page and mounted the card, correct in every respect, inside
 * something `display: none`. Which is a blank page holding a quarter of a
 * megabyte of pull request.
 */
describe("stepping aside after another interface has taken over", () => {
  const bothUp = (page: Document) => {
    const list = takeOverSlot(page, interfaceContainer(page, REPO_PULLS), REPO_PULLS)
    const card = takeOverSlot(page, interfaceContainer(page, CONVERSATION), CONVERSATION)
    return { list: list!, card: card! }
  }

  test("leaves the interface that replaced it on the page", () => {
    const page = githubPage()
    const { list, card } = bothUp(page)

    list.stepAside()

    expect<Element | null>(ourRoot(page)).toBe(card.container)
  })

  test("leaves it in charge, rather than lifting the rule that hides GitHub's", () => {
    // The flag is what keeps everything GitHub renders into the region out of
    // sight from the instant it exists. Lifting it here puts their conversation
    // back underneath a card that is still standing on top of it.
    const page = githubPage()
    const { list } = bothUp(page)

    list.stepAside()

    expect(page.documentElement.hasAttribute("data-gitquiet-taken")).toBe(true)
  })


  test("still gives everything back when it is the only interface there", () => {
    // The case this must not break: a card that could not read its pull request
    // steps aside on its own account, and GitHub's page is what the reader gets.
    const page = githubPage()
    const alone = takeOverSlot(page)

    alone!.stepAside()

    expect(page.documentElement.hasAttribute("data-gitquiet-taken")).toBe(false)
    expect(theirsIn(page).hasAttribute("hidden")).toBe(false)
    expect(ourRoot(page)).toBeNull()
  })
})

describe("which screen is on the page, as against which page is being fetched", () => {
  const homePage = (): Document => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = `
      <div class="feed-background">
        <div class="feed-content">
          <main class="flex-1"><div id="dashboard" class="dashboard">their feed</div></main>
        </div>
      </div>`
    return page
  }

  test("names the screen that took the page over", () => {
    const page = homePage()

    takeOverSlot(page, interfaceContainer(page, HOME), HOME)

    expect(page.documentElement.getAttribute("data-gitquiet-shown")).toBe("home")
  })

  test("keeps that name while a press marks the page for the card being fetched", () => {
    /*
     * The press is answered a whole second before the address moves, and it says
     * so straight away: the rules that hold GitHub's conversation back are keyed
     * on the page being *arrived at*, so the document has to be named for it.
     *
     * This name is not. The list is still the screen on the page — it is what the
     * reader is looking at until the card lands — and the push that answered the
     * press is watching this to find out whether the card ever did.
     */
    const page = homePage()
    takeOverSlot(page, interfaceContainer(page, HOME), HOME)

    markPage(page, CONVERSATION)

    expect(page.documentElement.getAttribute("data-gitquiet-page")).toBe("conversation")
    expect(page.documentElement.getAttribute("data-gitquiet-shown")).toBe("home")
  })

  test("hands the name to the interface that replaces this one", () => {
    const page = githubPage()
    takeOverSlot(page, interfaceContainer(page, REPO_PULLS), REPO_PULLS)

    const card = takeOverSlot(page, interfaceContainer(page, CONVERSATION), CONVERSATION)

    expect(card).not.toBeNull()
    expect(page.documentElement.getAttribute("data-gitquiet-shown")).toBe("conversation")
  })

  test("takes it off when the page is handed back", () => {
    const page = githubPage()
    const alone = takeOverSlot(page)

    alone!.stepAside()

    expect(page.documentElement.hasAttribute("data-gitquiet-shown")).toBe(false)
  })
})

/**
 * The rule that stops one page's content standing under another page's address.
 *
 * A press of ours starts the arriving screen at `pointerdown` and pushes the address at
 * `click`, which is the mouse button coming back up — a hundred milliseconds later, and
 * on a slow hand much longer. A screen that took the page in between replaced the bar,
 * and the bar holds the very link being pressed: the release then landed on an element
 * no longer in the document, no address was pushed, and the reader was left looking at
 * one page under another one's address until a repair reloaded the tab.
 *
 * The real document here, not a made one. The address is the thing under test and only a
 * document with a window has one.
 */
describe("taking the page only once the address is ours", () => {
  // Each of these stands a fresh surface in a document every other test in this
  // file has also been standing things in. The host and its shadow root are made
  // once per document and outlive a test that does not say otherwise.
  beforeEach(() => {
    letTheirStylesBack(document)
    document.body.innerHTML = ""
  })

  const LEFT = "/facebook/react/pull/1749"
  const ASKED = "/facebook/react/actions"

  /** Our own screen, standing where the reader can see it, as on any press of ours. */
  const standing = (): { readonly surface: Element; readonly arriving: Element } => {
    document.body.innerHTML = `<main><div id="theirs">their page</div></main>`
    const surface = document.createElement("div")
    document.querySelector("#theirs")!.append(surface)

    const arriving = document.createElement("div")
    return { surface, arriving }
  }

  const tidy = (): void => {
    // The host and its shadow root go with the body they stand in, and their
    // stylesheets come back on: both are module state that outlives one test.
    letTheirStylesBack(document)
    document.body.innerHTML = ""
    for (const name of [
      "data-gitquiet-taken",
      "data-gitquiet-shown",
      "data-gitquiet-revealed",
      "data-gitquiet-gating",
      "data-gitquiet-page"
    ])
      document.documentElement.removeAttribute(name)
  }

  test("waits while the address still names the page being left", async () => {
    history.replaceState(null, "", LEFT)
    const { surface, arriving } = standing()

    const waiting = Effect.runPromise(
      takeOverSlotWhenReady(document, arriving, 400, 20, ACTIONS, surface)
    )
    await new Promise((done) => setTimeout(done, 60))

    expect(arriving.isConnected).toBe(false)
    expect(document.documentElement.hasAttribute("data-gitquiet-taken")).toBe(false)

    history.pushState(null, "", ASKED)
    expect(await waiting).not.toBeNull()
    tidy()
  })

  test("takes it the moment the address arrives", async () => {
    history.replaceState(null, "", LEFT)
    const { surface, arriving } = standing()

    const waiting = Effect.runPromise(
      takeOverSlotWhenReady(document, arriving, 400, 20, ACTIONS, surface)
    )
    history.pushState(null, "", ASKED)

    expect(await waiting).not.toBeNull()
    expect(arriving.isConnected).toBe(true)
    tidy()
  })

  test("gives the page back where the address never arrives", async () => {
    // The press went nowhere: their router swallowed it, or the reader pressed
    // something else. Ours must not stand on a page it was never asked for.
    history.replaceState(null, "", LEFT)
    const { surface, arriving } = standing()

    const takeover = await Effect.runPromise(
      takeOverSlotWhenReady(document, arriving, 40, 20, ACTIONS, surface)
    )

    expect(takeover).toBeNull()
    expect(arriving.isConnected).toBe(false)
    tidy()
  })

  test("stands straight away when the address is already ours", async () => {
    // Every ordinary load. The document arrived at this address, so there is
    // nothing to wait for and the wait must cost nothing.
    history.replaceState(null, "", ASKED)
    const { surface, arriving } = standing()

    const takeover = await Effect.runPromise(
      takeOverSlotWhenReady(document, arriving, 400, 20, ACTIONS, surface)
    )

    // That it took the page at all, which is the whole of what this one is about:
    // the address was already ours, so there was nothing to wait for. Where the
    // container ends up is asserted by the tests that are about placement — and
    // asserting it here reads whatever the tests before it left in module state.
    expect(takeover).not.toBeNull()
    tidy()
  })
})

/*
 * The screens do not share memory, so what one of them knows the others hear or never
 * learn. Each is built as its own bundle, which means each has its own copy of this
 * module: the screen taking the page and the screen losing it are two programs, and the
 * only thing between them is the document they are both on.
 *
 * It was a set of callbacks in here, and every screen's set held only its own. So the bar
 * of a screen being replaced was never told the page had moved, went on drawing, and stood
 * beside the bar of the screen that replaced it — the two bars the reader kept reporting.
 */
describe("telling every screen's script that the page moved", () => {
  test("hears a move announced by another screen", async () => {
    let told = 0
    const stop = whenTheScreenMoves(document, () => {
      told += 1
    })

    theScreenMoved(document)
    await new Promise((ready) => setTimeout(ready, 0))
    expect(told).toBe(1)

    stop()
    theScreenMoved(document)
    await new Promise((ready) => setTimeout(ready, 0))
    expect(told).toBe(1)
  })

  test("says so when a screen takes the page from another", async () => {
    const page = githubPage()
    const leaving = interfaceContainer(page, CONVERSATION)
    slotOf(page).append(leaving)

    let told = 0
    const stop = whenTheScreenMoves(page, () => {
      told += 1
    })
    takeOverSlot(page, page.createElement("div"), CONVERSATION)
    await new Promise((ready) => setTimeout(ready, 0))
    stop()

    expect(told).toBeGreaterThan(0)
  })
})

describe("knowing that the screen a press asked for is the one on the page", () => {
  /*
   * Asked by the shell twice over: the push repairs the address by hand if the screen
   * never came, and reading ahead stays quiet until it has. Both of them were asking
   * which *kind* of screen was up, and a reader moving between two pull requests never
   * changes the kind.
   *
   * Measured on that press: the mark still read "conversation" at 0.4s, 1s, 2s, 4s and
   * 8s, because it had read "conversation" since the pull request they left. So both
   * callers were told the new page had arrived on the first frame, and the quiet period
   * that reading ahead depends on never happened on the one route that needed it most.
   */
  test("a move to another page of the same kind is not an arrival until it is drawn", () => {
    const target = githubPage()
    takeOverSlot(target)
    theScreenIsAt(target, "/o/r/pull/2002", Symbol("leaving"))

    expect(theScreenArrived(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(false)

    theScreenIsAt(target, "/o/r/pull/1999", Symbol("arriving"))

    expect(theScreenArrived(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(true)
  })

  test("the kind still has to match, for a move to another kind of page", () => {
    const target = githubPage()
    takeOverSlot(target)
    theScreenIsAt(target, "/o/r/pull/2002", Symbol("standing"))

    expect(theScreenArrived(target, "repo-pulls", "/o/r/pull/2002")).toBe(false)
  })

  test("nothing of ours on the page is not an arrival", () => {
    expect(theScreenArrived(githubPage(), CONVERSATION.name, "/o/r/pull/1999")).toBe(false)
  })

  test("a screen leaving withdraws its own address", () => {
    const target = githubPage()
    takeOverSlot(target)
    const standing = Symbol("standing")
    theScreenIsAt(target, "/o/r/pull/1999", standing)

    theScreenLeft(target, standing)

    expect(theScreenArrived(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(false)
  })

  /*
   * Two screens for one address, which is what a place with two containers produces:
   * see the inbox above, drawn twice. Both publish the same path, so a guard that
   * compared paths would let the stray one withdraw the survivor's mark.
   */
  test("and a stray screen leaving does not withdraw the standing screen's address", () => {
    const target = githubPage()
    takeOverSlot(target)
    const stray = Symbol("stray")
    theScreenIsAt(target, "/o/r/pull/1999", stray)
    theScreenIsAt(target, "/o/r/pull/1999", Symbol("standing"))

    theScreenLeft(target, stray)

    expect(theScreenArrived(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(true)
  })
})

/*
 * The repair in `going.ts` loads a whole document when it is told the screen never
 * came, so what it asks has to fall the other way from the strict test above: silence
 * from a screen that publishes nothing is not evidence of a failure.
 */
describe("knowing that a press went wrong, for the caller that reloads the page", () => {
  test("a screen that says nothing about its address is left alone", () => {
    const target = githubPage()
    takeOverSlot(target)

    expect(theScreenIsNotElsewhere(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(true)
  })

  test("a screen standing for the address that was pushed is right where it should be", () => {
    const target = githubPage()
    takeOverSlot(target)
    theScreenIsAt(target, "/o/r/pull/1999", Symbol("standing"))

    expect(theScreenIsNotElsewhere(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(true)
  })

  test("a screen standing for another address is the case worth repairing", () => {
    const target = githubPage()
    takeOverSlot(target)
    theScreenIsAt(target, "/o/r/pull/2002", Symbol("standing"))

    expect(theScreenIsNotElsewhere(target, CONVERSATION.name, "/o/r/pull/1999")).toBe(false)
  })

  test("and so is a screen of another kind entirely", () => {
    const target = githubPage()
    takeOverSlot(target)

    expect(theScreenIsNotElsewhere(target, "repo-pulls", "/o/r/pull/1999")).toBe(false)
  })
})
