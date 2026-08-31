import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { fromPathname } from "../domain/PullRequestRef"
import { BAR_ID } from "./barSlot"
import {
  answerPress,
  answerPressesIn,
  drawingOurOwnRows,
  goBack,
  goBackTo,
  goForward,
  goTo,
  goWithin,
  holdForRedraw,
  ourOwnRowsDrawn,
  oursToAnswer,
  theTrail,
  watchTheTrail
} from "./going"
import { ourSurface, ROOT_ID } from "./mount"

/** What a list of pull requests can hand its surface over to, which is any of them. */
const aPullRequest = (path: string): boolean => Option.isSome(fromPathname(path))

type Recorded = {
  readonly pushed: Array<string>
  /** What was pushed onto the entry beside the address. See `cameFrom`. */
  readonly stated: Array<unknown>
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

  const recorded: Recorded = { pushed: [], stated: [], replaced: [], later: [] }
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
    history: {
      pushState: (state: unknown, _: string, path: string) => {
        recorded.stated.push(state)
        recorded.pushed.push(path)
      }
    },
    setTimeout: (run: () => void) => {
      recorded.later.push(run)
      return 0
    }
  } as unknown as Window

  return { window: target, screen, recorded }
}

describe("returning within one standing screen", () => {
  test("keeps its surface until the returned page redraws", () => {
    const page = aPageOfOurs()
    drawingOurOwnRows(page.window, true)

    const inPlace = holdForRedraw(page.window, true)

    expect(inPlace).toBe(true)
    expect(ourSurface(page.window.document)).toBe(page.window.document.body)
  })
})

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

/** The address, arrived where a push of ours sent it. */
const arrivedAt = (target: Window, pathname: string, search: string = ""): void => {
  const at = target.location as { pathname: string; search: string }
  at.pathname = pathname
  at.search = search
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

/*
 * The repair is for a screen that is not coming, and a screen on its way is not
 * that. Signed out, on a cold cache, the screen for a big repository can still
 * be standing up when the deadline fires — and the repair then loads a whole
 * document over a press that was working, which throws away every live screen
 * the document was holding for Back. Demonstrated on live github.com by
 * scripts/probe-back-live.ts.
 */
describe("an address moved to a screen that is still arriving", () => {
  /** Runs whatever the deadline queued, once, and hands back what it queued next. */
  const deadlinePasses = (page: ReturnType<typeof aPageOfOurs>): number => {
    const queued = [...page.recorded.later]
    page.recorded.later.length = 0
    queued.forEach((run) => run())
    return page.recorded.later.length
  }

  test("is waited for while the gate says a takeover is coming", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    page.window.document.documentElement.setAttribute("data-gitquiet-gating", "")
    const rearmed = deadlinePasses(page)

    expect(page.recorded.replaced).toEqual([])
    expect(rearmed).toBe(1)
  })

  test("is waited for while a standing screen is visibly still reading", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    const reading = page.window.document.createElement("div")
    reading.setAttribute("data-gitquiet-loading", "")
    page.screen.append(reading)
    deadlinePasses(page)

    expect(page.recorded.replaced).toEqual([])
  })

  test("is left alone once the wait ends in the screen it was waiting for", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    page.window.document.documentElement.setAttribute("data-gitquiet-gating", "")
    deadlinePasses(page)

    // The takeover settled: the gate came down and the card stands where the
    // list was, which is what an arrival looks like from here.
    page.window.document.documentElement.removeAttribute("data-gitquiet-gating")
    page.screen.remove()
    const card = page.window.document.createElement("div")
    card.id = ROOT_ID
    page.window.document.body.append(card)
    deadlinePasses(page)

    expect(page.recorded.replaced).toEqual([])
  })

  test("is repaired once nothing says anything is coming any more", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    page.window.document.documentElement.setAttribute("data-gitquiet-gating", "")
    deadlinePasses(page)
    page.window.document.documentElement.removeAttribute("data-gitquiet-gating")
    deadlinePasses(page)

    expect(page.recorded.replaced).toEqual(["/owner/repo/pull/12"])
  })

  test("does not wait forever on a read that never ends", () => {
    const page = aPageOfOurs()
    answerPressesIn(page.screen, page.window, aPullRequest)
    press(rowIn(page.screen))
    ;(page.window.location as { pathname: string }).pathname = "/owner/repo/pull/12"

    // A wedged read: the marker never comes down. The failsafe has to stay one.
    const reading = page.window.document.createElement("div")
    reading.setAttribute("data-gitquiet-loading", "")
    page.screen.append(reading)

    let deadlines = 0
    while (deadlinePasses(page) > 0 && deadlines < 20) deadlines += 1

    expect(page.recorded.replaced).toEqual(["/owner/repo/pull/12"])
    expect(deadlines).toBeLessThan(20)
  })
})

describe("another view of the screen already standing", () => {
  /*
   * Why this is a function and not a push. The watcher every screen hears the
   * address on reads the pathname and nothing else — see `whenLocationChanges` —
   * so a second page of a list, which changes the search alone, is an address
   * change no screen is ever told about. Pushing it and waiting to be told left
   * the first page on the screen under the second page's address, and the
   * deadline below then loaded the whole document. Loading it directly was what
   * these screens did instead, and it cost the reader everything already read.
   */
  test("moves the address and redraws in place, rather than loading a document", () => {
    const page = aPageOfOurs()
    const drawn: Array<string> = []
    let standingFor = "/issues/assigned"

    goWithin(
      page.window,
      "/issues/assigned?page=2",
      () => {
        standingFor = "/issues/assigned?page=2"
        drawn.push(standingFor)
      },
      () => standingFor
    )

    expect(page.recorded.pushed).toEqual(["/issues/assigned?page=2"])
    expect(drawn).toEqual(["/issues/assigned?page=2"])
    expect(page.recorded.replaced).toEqual([])
  })

  test("leaves the address alone where the screen redrew for it", () => {
    const page = aPageOfOurs()
    let standingFor = "/issues/assigned"

    goWithin(
      page.window,
      "/issues/assigned?page=2",
      () => {
        standingFor = "/issues/assigned?page=2"
      },
      () => standingFor
    )
    arrivedAt(page.window, "/issues/assigned", "?page=2")
    page.recorded.later.forEach((run) => run())

    expect(page.recorded.replaced).toEqual([])
  })

  test("loads the document where nothing redrew, so the reader is not left where they pressed", () => {
    const page = aPageOfOurs()
    // A read that threw, a page that is not there: whatever the reason, the
    // screen standing is still the one the reader asked to leave.
    const standingFor = "/issues/assigned"

    goWithin(page.window, "/issues/assigned?page=2", () => {}, () => standingFor)
    arrivedAt(page.window, "/issues/assigned", "?page=2")
    page.recorded.later.forEach((run) => run())

    expect(page.recorded.replaced).toEqual(["/issues/assigned?page=2"])
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
 * Nothing of ours on the entry a push makes. It was tried, to carry the address
 * being left, and the slot on a GitHub page holds Turbo's own record — see `goTo`.
 * The entries themselves say where the reader has been.
 */
describe("the entry a push of ours makes", () => {
  test("leaves GitHub's own state slot alone", () => {
    const page = aPageOfOurs()

    goTo(page.window, "/owner/repo/pull/12")

    expect(page.recorded.stated).toEqual([null])
  })
})

/**
 * A tab that has been somewhere, as the Navigation API describes one.
 *
 * `entries` are the addresses in order and `here` is which of them the reader is
 * standing on, which is the pair the real API answers with. `length` is history's
 * own count, and it is deliberately allowed to disagree: `entries()` holds the
 * same-origin run this page is part of and nothing before it.
 */
const aTabThatHasBeen = ({
  entries,
  here,
  length = entries.length,
  api = true
}: {
  readonly entries: ReadonlyArray<string>
  readonly here: number
  readonly length?: number
  readonly api?: boolean
}): { readonly window: Window; readonly traversed: Array<string>; readonly went: Array<number> } => {
  const traversed: Array<string> = []
  const went: Array<number> = []

  const navigation = {
    entries: () =>
      entries.map((url, index) => ({ url: `https://github.com${url}`, key: `k${index}`, index })),
    currentEntry: { index: here },
    canGoBack: here > 0,
    canGoForward: here < entries.length - 1,
    traverseTo: (key: string) => {
      traversed.push(key)
      return undefined
    }
  }

  const target = {
    history: {
      length,
      back: () => went.push(-1),
      forward: () => went.push(1),
      go: (by: number) => went.push(by)
    },
    ...(api ? { navigation } : {})
  } as unknown as Window

  return { window: target, traversed, went }
}

describe("where the reader can go from here", () => {
  test("lists the places behind, nearest first", () => {
    const tab = aTabThatHasBeen({
      entries: ["/pulls", "/owner/repo/pulls", "/owner/repo/pull/12"],
      here: 2
    })

    expect(theTrail(tab.window).behind).toEqual([
      { at: "/owner/repo/pulls", key: "k1", back: 1 },
      { at: "/pulls", key: "k0", back: 2 }
    ])
  })

  /*
   * Their router replaces an entry for a filter, a heading or a scroll position,
   * and a reader walking a stack passes the same list between layers. A menu
   * offering the Working Set five times says nothing five times, and the nearest
   * of them is the one worth going to.
   */
  test("says one address once, keeping the nearest of them", () => {
    const tab = aTabThatHasBeen({
      entries: ["/pulls", "/owner/repo/pull/12", "/pulls", "/owner/repo/pull/14"],
      here: 3
    })

    expect(theTrail(tab.window).behind).toEqual([
      { at: "/pulls", key: "k2", back: 1 },
      { at: "/owner/repo/pull/12", key: "k1", back: 2 }
    ])
  })

  test("keeps the search, two pages of one list being two places", () => {
    const tab = aTabThatHasBeen({
      entries: ["/owner/repo/pulls", "/owner/repo/pulls?page=2"],
      here: 1
    })

    expect(theTrail(tab.window).behind).toEqual([
      { at: "/owner/repo/pulls", key: "k0", back: 1 }
    ])
  })

  test("stops at eight, a menu being read at a glance", () => {
    const tab = aTabThatHasBeen({
      entries: Array.from({ length: 20 }, (_, at) => `/owner/repo/pull/${at}`),
      here: 19
    })

    expect(theTrail(tab.window).behind).toHaveLength(8)
  })

  test("says whether there is anywhere ahead, which there is only after going back", () => {
    const ahead = aTabThatHasBeen({ entries: ["/pulls", "/owner/repo/pull/12"], here: 0 })
    const nothing = aTabThatHasBeen({ entries: ["/pulls", "/owner/repo/pull/12"], here: 1 })

    expect(theTrail(ahead.window).forward).toBe(true)
    expect(theTrail(ahead.window).ahead).toBe("/owner/repo/pull/12")
    expect(theTrail(nothing.window).forward).toBe(false)
    expect(theTrail(nothing.window).ahead).toBeUndefined()
  })

  /*
   * A reader who reached GitHub from somewhere else stands at index 0 of a list
   * that cannot show what is before it. `back()` still returns there, so the
   * button is drawn and the menu has nothing to add.
   */
  test("still offers back at the start of the list, where the count knows better", () => {
    const tab = aTabThatHasBeen({ entries: ["/owner/repo/pull/12"], here: 0, length: 3 })

    expect(theTrail(tab.window)).toEqual({ back: true, forward: false, behind: [] })
  })

  test("offers nothing at all on a tab opened straight onto the page", () => {
    const tab = aTabThatHasBeen({ entries: ["/owner/repo/pull/12"], here: 0, length: 1 })

    expect(theTrail(tab.window)).toEqual({ back: false, forward: false, behind: [] })
  })

  /*
   * The count is all a browser without the API will say, so the two buttons work
   * and no menu is offered. Nothing guesses at a forward entry from a count: the
   * count includes them and cannot say so.
   */
  test("falls back to the count where the entries cannot be read", () => {
    const tab = aTabThatHasBeen({ entries: ["/pulls"], here: 0, length: 4, api: false })

    expect(theTrail(tab.window)).toEqual({ back: true, forward: false, behind: [] })
  })
})

describe("going back and forward", () => {
  test("moves one page each way through the browser", () => {
    const tab = aTabThatHasBeen({ entries: ["/pulls", "/owner/repo/pull/12"], here: 1 })

    goBack(tab.window)
    goForward(tab.window)

    expect(tab.went).toEqual([-1, 1])
  })

  /*
   * By the entry rather than by a count. A count is a promise about a list that
   * may have changed since it was read, and `go(-4)` would then land on whatever
   * is four back now.
   */
  test("goes to a place in the trail by the entry the browser named", () => {
    const tab = aTabThatHasBeen({
      entries: ["/pulls", "/owner/repo/pulls", "/owner/repo/pull/12"],
      here: 2
    })

    goBackTo(tab.window, { at: "/pulls", key: "k0", back: 2 })

    expect(tab.traversed).toEqual(["k0"])
    expect(tab.went).toEqual([])
  })

  test("counts the steps where there is no entry to name", () => {
    const tab = aTabThatHasBeen({ entries: ["/pulls"], here: 0, api: false })

    goBackTo(tab.window, { at: "/pulls", back: 3 })

    expect(tab.went).toEqual([-3])
  })
})

describe("hearing that the trail moved", () => {
  test("asks the API, which hears a push as well as a traversal", () => {
    const heard: Array<string> = []
    const target = {
      navigation: {
        addEventListener: (name: string) => heard.push(`on ${name}`),
        removeEventListener: (name: string) => heard.push(`off ${name}`)
      }
    } as unknown as Window

    watchTheTrail(target, () => {})()

    expect(heard).toEqual(["on currententrychange", "off currententrychange"])
  })

  test("falls back to the event a browser without it still sends", () => {
    const heard: Array<string> = []
    const target = {
      addEventListener: (name: string) => heard.push(`on ${name}`),
      removeEventListener: (name: string) => heard.push(`off ${name}`)
    } as unknown as Window

    watchTheTrail(target, () => {})()

    expect(heard).toEqual(["on popstate", "off popstate"])
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
