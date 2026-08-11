import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { fromPathname } from "../domain/PullRequestRef"
import { BAR_ID } from "./barSlot"
import {
  answerPress,
  answerPressesIn,
  drawingOurOwnRows,
  goTo,
  ourOwnRowsDrawn,
  oursToAnswer
} from "./going"
import { ROOT_ID } from "./mount"

/** What a list of pull requests can hand its surface over to, which is any of them. */
const aPullRequest = (path: string): boolean => Option.isSome(fromPathname(path))

type Recorded = {
  readonly pushed: Array<string>
  readonly replaced: Array<string>
  readonly later: Array<() => void>
}

/**
 * A page with one of our screens on it, and a window that writes down what was
 * asked of history rather than doing it.
 *
 * The address is the thing under test, so it is watched rather than moved: this
 * runs in a document with no history of its own, and a real `pushState` here
 * would tell us nothing about what a browser would then be showing.
 */
const aPageOfOurs = (): {
  readonly window: Window
  readonly screen: Element
  readonly recorded: Recorded
} => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div id="${BAR_ID}">
      <a href="https://github.com/" aria-label="Home">the mark</a>
    </div>
    <div id="${ROOT_ID}">
      <a href="https://github.com/owner/repo/pull/12" aria-label="a pull request">a row</a>
      <a href="https://github.com/owner/repo">the repository</a>
      <a href="https://github.com/pulls" aria-label="the list">Pull requests</a>
      <!--
        A heading in a rendered README. GitHub writes it as \`#quick-start\` and
        the browser resolves the rest from the document; written out in full here
        because this document has no address for it to be resolved against.
      -->
      <a href="https://github.com/owner/repo#quick-start" aria-label="a heading in the README">Quick start</a>
      <a href="https://github.com/owner/repo/pull/12?diff=split#L23" aria-label="a line in a file">src/app.ts:23</a>
    </div>
    <div id="theirs">
      <a href="https://github.com/owner/repo/issues" aria-label="their tab">Issues</a>
    </div>`

  const recorded: Recorded = { pushed: [], replaced: [], later: [] }
  const screen = page.getElementById(ROOT_ID) as Element

  const target = {
    document: page,
    location: {
      hostname: "github.com",
      pathname: "/pulls/inbox",
      search: "",
      hash: "",
      replace: (path: string) => recorded.replaced.push(path)
    },
    history: { pushState: (_: unknown, __: string, path: string) => recorded.pushed.push(path) },
    setTimeout: (run: () => void) => {
      recorded.later.push(run)
      return 0
    }
  } as unknown as Window

  return { window: target, screen, recorded }
}

/** A press, as a browser makes one: on the row, and heard by the container. */
const press = (on: Element, held?: "meta"): Event => {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: held === "meta" })
  on.dispatchEvent(event)
  return event
}

/** GitHub, watching every press on the page from the top of the document. */
const theyCancelPresses = (page: Document): void => {
  page.addEventListener("click", (event) => event.preventDefault(), true)
}

const rowIn = (screen: Element): Element =>
  screen.querySelector('a[aria-label="a pull request"]') as Element

describe("a press on a row of ours", () => {
  test("moves the address to the pull request instead of loading it", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)

    const event = press(rowIn(page.screen))

    expect(page.recorded.pushed).toEqual(["/owner/repo/pull/12"])
    expect(event.defaultPrevented).toBe(true)
  })

  /*
   * A file and a line, which is what a build log's failing step links to. The
   * address used to be pushed as the path and the search only, so `#L23` was
   * dropped on the way — the reader asked for line 23 and got an address that
   * says nothing about it, and copying that address sends someone the top of
   * the file.
   */
  test("carries the whole of the address, down to the line that was asked for", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)

    press(page.screen.querySelector('a[aria-label="a line in a file"]') as Element)

    expect(page.recorded.pushed).toEqual(["/owner/repo/pull/12?diff=split#L23"])
  })

  test("is left to the browser where a key is held down, which means a new tab", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)

    const event = press(rowIn(page.screen), "meta")

    expect(page.recorded.pushed).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  test("is left to the browser where the link is not a pull request", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)

    const event = press(page.screen.querySelector('a[href$="/owner/repo"]') as Element)

    expect(page.recorded.pushed).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  /*
   * The row is ours, drawn into a region GitHub was never told about, so a press
   * on it is not theirs to cancel. Deferring to them left the reader on a page
   * where nothing happened: no address moved, and the card drawn on the promise
   * of that press gave up six seconds later and took the list with it.
   */
  test("is answered even where GitHub has cancelled it from the top of the document", () => {
    const page = aPageOfOurs()
    theyCancelPresses(page.window.document)
    answerPressesIn(page.screen, page.window, aPullRequest)

    press(rowIn(page.screen))

    expect(page.recorded.pushed).toEqual(["/owner/repo/pull/12"])
  })

  test("stops being answered once the screen that drew it has gone", () => {
    const page = aPageOfOurs()
    const stop = answerPressesIn(page.screen, page.window, aPullRequest)

    stop()
    const event = press(rowIn(page.screen))

    expect(page.recorded.pushed).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })
})

/*
 * The card can hand its surface back to the list it came from, because GitHub's
 * own dashboard is hidden rather than gone and is still there to stand in. It
 * cannot hand over to another pull request: that one would have to stand in a
 * region GitHub has never rendered, so the document for it is worth asking for.
 */
describe("a screen that answers for some addresses and not others", () => {
  const theList = (path: string): boolean => /^\/pulls(\/|$)/.test(path)

  test("answers a press headed somewhere it named", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, theList)

    const event = press(page.screen.querySelector('a[aria-label="the list"]') as Element)

    expect(page.recorded.pushed).toEqual(["/pulls"])
    expect(event.defaultPrevented).toBe(true)
  })

  test("leaves the rest to GitHub, who have the document for them", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, theList)

    const event = press(rowIn(page.screen))

    expect(page.recorded.pushed).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })
})

describe("an address moved to a screen that never arrives", () => {
  /*
   * The bug this exists for. Pushing the address is one script's work and drawing
   * the screen for it is another's, so the two can come apart — and what that
   * leaves is an address naming a pull request, the list still on the screen, and
   * a history entry with nothing behind it. Pressing Back then appears to skip
   * the page the reader was looking at, because the page never changed.
   */
  test("is loaded properly, over the entry that was pushed rather than beside it", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))

    // Nothing new on the page, and the address has arrived where it was sent.
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"
    page.recorded.later.forEach((run) => run())

    expect(page.recorded.replaced).toEqual(["/owner/repo/pull/12"])
  })

  test("is left alone once a screen has arrived", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    // The card, standing where the list was: a container of its own, which is
    // what the screen arriving looks like from here.
    page.screen.remove()
    const card = page.window.document.createElement("div")
    card.id = ROOT_ID
    page.window.document.body.append(card)
    page.recorded.later.forEach((run) => run())

    expect(page.recorded.replaced).toEqual([])
  })

  test("is left alone where the reader has already gone somewhere else", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))

    // The back button, or a second press. This address is nobody's to repair.
    ;(page.window.location as { pathname: string }).pathname = "/pulls/inbox"
    page.recorded.later.forEach((run) => run())

    expect(page.recorded.replaced).toEqual([])
  })
})

describe("the screen that draws its own rows", () => {
  test("says so for as long as it is on the page, and not after", () => {
    const target = {} as Window

    expect(ourOwnRowsDrawn(target)).toBe(false)
    drawingOurOwnRows(target, true)
    expect(ourOwnRowsDrawn(target)).toBe(true)
    drawingOurOwnRows(target, false)
    expect(ourOwnRowsDrawn(target)).toBe(false)
  })
})

describe("going somewhere by hand, as the keyboard does", () => {
  test("moves the address without asking for a document", () => {
    const page = aPageOfOurs()

    goTo(page.window, "/owner/repo/pull/12")

    expect(page.recorded.pushed).toEqual(["/owner/repo/pull/12"])
    expect(page.recorded.replaced).toEqual([])
  })

  /*
   * Two things answer one press: the shell, which sees every press on the page
   * from the top of the document, and the screen's own handler underneath it. A
   * second entry for one gesture is a back button that appears to do nothing.
   */
  test("says nothing about the address the page is already at", () => {
    const page = aPageOfOurs()

    goTo(page.window, "/pulls/inbox")

    expect(page.recorded.pushed).toEqual([])
    expect(page.recorded.replaced).toEqual([])
  })

  test("counts the search as part of the address, so a second page of a list is a move", () => {
    const page = aPageOfOurs()
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pulls"

    goTo(page.window, "/owner/repo/pulls?page=2")

    expect(page.recorded.pushed).toEqual(["/owner/repo/pulls?page=2"])
  })

  /*
   * Leaving a heading behind is a move like any other. Counting only the path
   * and the search made this address look like the one the page was already at,
   * so nothing was pushed and `#quick-start` stayed in the address bar over a
   * page that no longer had a Quick start on it.
   */
  test("counts the heading as part of the address, so leaving one is a move", () => {
    const page = aPageOfOurs()
    const at = page.window.location as { pathname: string; hash: string }
    at.pathname = "/owner/repo"
    at.hash = "#quick-start"

    goTo(page.window, "/owner/repo")

    expect(page.recorded.pushed).toEqual(["/owner/repo"])
  })
})

/*
 * The repair asks whether the screen for the new address turned up, and only the
 * caller knows what turning up looks like. A screen that is already standing and
 * redraws in place never changes container, so the container alone would call a
 * successful move a failure and load the document the push existed to avoid.
 */
describe("what counts as the screen having arrived", () => {
  const settled = (page: ReturnType<typeof aPageOfOurs>, path: string) => {
    ;(page.window.location as { pathname: string }).pathname = path
    page.recorded.later.forEach((run) => run())
  }

  test("is the caller's answer where one is given, over the container it started with", () => {
    const page = aPageOfOurs()

    goTo(page.window, "/owner/repo/pull/12", () => true)
    settled(page, "/owner/repo/pull/12")

    expect(page.recorded.replaced).toEqual([])
  })

  test("loads the address properly where the caller says nothing arrived", () => {
    const page = aPageOfOurs()

    goTo(page.window, "/owner/repo/pull/12", () => false)
    settled(page, "/owner/repo/pull/12")

    expect(page.recorded.replaced).toEqual(["/owner/repo/pull/12"])
  })
})

/*
 * The whole of the rule, in one question. Everything this extension draws is
 * inside one of two elements, and a press on a link in either of them is not
 * GitHub's router's to answer — see `whenTheyStayPut`, which is what answering
 * it their way costs.
 */
describe("whether a press is ours to answer", () => {
  const linkTo = (page: ReturnType<typeof aPageOfOurs>, label: string): Element =>
    page.window.document.querySelector(`a[aria-label="${label}"]`) as Element

  test("answers for a row a screen of ours drew", () => {
    const page = aPageOfOurs()

    expect(oursToAnswer(linkTo(page, "a pull request"), page.window)).toBe(true)
  })

  test("answers for the bar, which stands outside the screen and is ours all the same", () => {
    // The bug this was written for: the Home mark is in `#gitquiet-bar`, a child
    // of `body`, so every handler attached to a screen's own container missed it.
    const page = aPageOfOurs()

    expect(oursToAnswer(linkTo(page, "Home"), page.window)).toBe(true)
  })

  test("leaves GitHub's own links to GitHub", () => {
    const page = aPageOfOurs()

    expect(oursToAnswer(linkTo(page, "their tab"), page.window)).toBe(false)
  })

  test("declines where no screen of ours is on the page to stand on", () => {
    const page = aPageOfOurs()
    const link = linkTo(page, "Home")
    page.screen.remove()

    expect(oursToAnswer(link, page.window)).toBe(false)
  })
})

/*
 * The bug this exists for, and the reason it is one function rather than a rule
 * each caller remembers.
 *
 * A press is three events and only the last of them is a navigation. The shell
 * wants the first: it fetches the next screen while the reader is still holding
 * the button down, which is where the fifth of a second comes from. It used to
 * move the address there too — and moving the address swaps the screen, so the
 * anchor the press began on was gone before the reader let go. The press that
 * landed was one nothing here could see, let alone cancel, and the browser
 * loaded the whole document for a page already drawn. About two hundred
 * milliseconds of interface, and then the reload it exists to avoid.
 */
describe("a press, which is three events and one navigation", () => {
  const events = ["pointerdown", "mousedown", "click"] as const

  const answering = (page: ReturnType<typeof aPageOfOurs>, label: string) => {
    const said: Array<string> = []
    let cancelledWhenItMoved: boolean | null = null

    const on = (type: string): Event => {
      const link = page.window.document.querySelector(
        `a[aria-label="${label}"]`
      ) as HTMLAnchorElement
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 })
      link.dispatchEvent(event)

      answerPress(event, link, page.window, {
        theirs: () => said.push("theirs"),
        ready: () => said.push("ready"),
        go: () => {
          cancelledWhenItMoved = event.defaultPrevented
          said.push("go")
        }
      })
      return event
    }

    return { on, said, moved: () => cancelledWhenItMoved }
  }

  test("does everything but the address while the reader is still holding the button", () => {
    const press = answering(aPageOfOurs(), "a pull request")

    const down = press.on("pointerdown")

    expect(press.said).toEqual(["ready"])
    expect(down.defaultPrevented).toBe(false)
  })

  test("moves the address once, on the event that would have loaded the document", () => {
    const press = answering(aPageOfOurs(), "a pull request")

    for (const type of events) press.on(type)

    expect(press.said).toEqual(["ready", "ready", "go"])
  })

  /*
   * The order, which is the whole of the fix. Cancelling after the address has
   * moved cancels nothing: the screen swaps in between, and by then this handler
   * is holding an anchor that is no longer in the document.
   */
  test("cancels the press before it moves the address, and not after", () => {
    const press = answering(aPageOfOurs(), "a pull request")

    const event = press.on("click")

    expect(press.moved()).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })

  test("leaves every event of a press on GitHub's own link to GitHub", () => {
    const press = answering(aPageOfOurs(), "their tab")

    for (const type of events) press.on(type)

    expect(press.said).toEqual(["theirs", "theirs", "theirs"])
  })

  /*
   * A heading in a README, which is a link this extension drew to the page it is
   * already on. Cancelling it took the reader nowhere: the browser's jump was
   * stopped, nothing was pushed because the address had not changed, and the
   * `#quick-start` a reader wanted to copy never reached the address bar.
   *
   * There is nothing here to answer. Only the browser can jump to a heading and
   * scroll to it; `pushState` moves the address and leaves the page where it is.
   */
  test("leaves a jump within the page to the browser, which is the only thing that can make one", () => {
    const page = aPageOfOurs()
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo"
    const press = answering(page, "a heading in the README")

    const event = press.on("click")

    expect(press.said).toEqual(["theirs"])
    expect(event.defaultPrevented).toBe(false)
  })
})
