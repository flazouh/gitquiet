export const ROOT_ID = "githubpro-root"

/**
 * Where the interface goes: the region GitHub fills with the conversation,
 * below their own pull request header.
 *
 * The header above it — title, state, branch, the Conversation / Commits /
 * Checks / Files tabs — is left exactly as it is, along with the site header
 * and the repository nav. Those are how someone gets around GitHub, they
 * already work, and replacing them would only make this page stranger than the
 * one beside it.
 *
 * Primer's class names carry a per-deploy hash — `prc-PageLayout-Content-BneH9`
 * today, something else next week — so these match on the part that is stable
 * and fall back to the whole repository content when the layout moves.
 */
const CONVERSATION = [
  'react-app[app-name="pull-requests"] [class*="PageLayoutContent"]',
  '[class*="PageLayoutContent"]'
]

/**
 * Where to go when the region cannot be found at all: the whole repository
 * content, which is a worse place to be but is still the right part of the page.
 *
 * It is also much further up the document, and therefore parsed long before the
 * region it contains. That matters now that this runs at `document_start`: ask
 * for either and the answer during parsing is always this one, and the interface
 * would take the entire repository content on every single load while the code
 * claimed to be replacing a conversation. So it is only offered once parsing is
 * over and its absence means something.
 */
const WHOLE_CONTENT = "#repo-content-pjax-container"

const firstOf = (target: Document, selectors: ReadonlyArray<string>): Element | null => {
  for (const selector of selectors) {
    const found = target.querySelector(selector)
    if (found !== null) return found
  }
  return null
}

/** The region itself, and nothing else — the only acceptable answer mid-parse. */
export const findConversationSlot = (target: Document): Element | null =>
  firstOf(target, CONVERSATION)

export const findSlot = (target: Document): Element | null =>
  firstOf(target, [...CONVERSATION, WHOLE_CONTENT])

/** Marks what GitHub rendered into the slot, so it can be hidden again if it comes back. */
const HIDDEN = "data-githubpro-hidden"

/**
 * Says that the page may be shown: either ours is on it, or this has given up
 * and theirs is the best thing to show.
 *
 * Until it is set, the rule in `gate.css` keeps GitHub's conversation, header
 * and tabs off the screen. Nothing else sets it, and something must: a page
 * left gated is a blank page.
 */
const REVEALED = "data-githubpro-revealed"

/**
 * The other gate: the one belonging to the small script that runs on every
 * GitHub page, which holds the conversation back on a page that never loaded as
 * one.
 *
 * Kept apart from {@link REVEALED} on purpose, and lifted only by
 * {@link ungate}. The interface can be injected into a document while GitHub is
 * still navigating, at a moment when the address is the list it is leaving
 * rather than the pull request it is heading for. It has to reveal then —
 * `gate.css` arrives with it and would otherwise hide the list — and if
 * revealing also lifted this gate, it would be dropping the guard a fraction of
 * a second before the conversation it exists to hide is rendered.
 */
const GATING = "data-githubpro-gating"

export const reveal = (target: Document): void => {
  target.documentElement.setAttribute(REVEALED, "")
}

/**
 * Lets GitHub's conversation through: this has either put something in front of
 * it or decided it is not going to.
 */
export const ungate = (target: Document): void => {
  target.documentElement.removeAttribute(GATING)
}

/**
 * Hides GitHub's conversation again, for the next pull request.
 *
 * On a page load the rule is already in force before this file runs and there
 * is nothing to do. On a soft navigation there is: the page has been revealed
 * for the pull request being left, and unless it is gated again the one being
 * arrived at appears in GitHub's own hand first and ours replaces it a moment
 * later, which is the flash this whole arrangement exists to avoid.
 */
export const gate = (target: Document): void => {
  target.documentElement.removeAttribute(REVEALED)
  target.documentElement.setAttribute(GATING, "")
}

/**
 * Says that the interface is the one in charge of the conversation region.
 *
 * Different from {@link REVEALED}, which only says the page may be shown: a
 * pull request this gave up on is revealed and not taken, and GitHub's own
 * conversation is what the reader gets.
 *
 * While it is set, `gate.css` keeps everything in that region that is not ours
 * out of sight. That is the part attribute-hiding cannot do on its own —
 * GitHub's React re-renders the region long after the takeover and inserts
 * children that are, for the moment before the observer notices them, perfectly
 * visible. A rule keyed off this hides them from the instant they exist.
 */
const TAKEN = "data-githubpro-taken"

/**
 * The element the interface is drawn into.
 *
 * Handed out before there is anywhere on the page to put it, so React can build
 * the tree while GitHub's HTML is still arriving. A detached container renders
 * exactly as well as an attached one — the work is the same, only the paint
 * waits — and `takeOverSlot` puts this element into the region once the parser
 * has produced one.
 */
export const interfaceContainer = (target: Document): Element => {
  const already = target.getElementById(ROOT_ID)
  if (already !== null) return already

  const made = target.createElement("div")
  made.id = ROOT_ID
  return made
}

/**
 * Their header: title, state, branch chips, the corner buttons, and the
 * Conversation / Commits / Checks / Files changed row beneath them.
 *
 * All of it goes, because ours says the same things in one band instead of
 * four, and two headers one above the other make the reader work out which
 * page they are on before they can do anything. The site header and the
 * repository nav above remain GitHub's: that is how anyone gets anywhere else.
 *
 * Matched on the stable part of the class name — Primer's carry a per-deploy
 * hash — with the tab row named separately because it survives on its own when
 * the header around it is rearranged.
 */
const THEIR_HEADER = [
  '[class*="PullRequestHeader"]',
  '[aria-label="Pull request navigation tabs"]',
  // And the same band on a commit's own page, where GitHub says the message,
  // the parent and how many files changed above the diff — all of which the
  // panel below repeats. Scoped to the app that renders a commit rather than
  // written against the layout class alone: a pull request has a header in the
  // same position, and hiding that one here would take their title row off
  // every pull request as well.
  'react-app[app-name="commits"] [class*="PageLayout-Header"]'
]

const hide = (element: Element): void => {
  if (element.hasAttribute(HIDDEN)) return
  element.setAttribute(HIDDEN, "")
  element.setAttribute("hidden", "")
}

const hideTheirHeader = (target: Document): void => {
  for (const selector of THEIR_HEADER) {
    for (const band of target.querySelectorAll(selector)) hide(band)
  }
}

const hideTheirs = (slot: Element, root: Element): void => {
  for (const child of slot.children) {
    // Never ours. A second takeover — a development reload, a script injected
    // twice — would otherwise hide the interface the first one rendered and
    // leave the page apparently empty while the DOM insists it is all there.
    if (child === root || child.id === ROOT_ID) continue
    hide(child)
  }
}

/**
 * How long to wait for GitHub to render the region before giving up on it.
 *
 * They render it with React after the document is done, so at the moment a
 * content script runs the slot reliably does not exist yet. Long enough for a
 * slow pull request on a slow connection; short enough that a page which is
 * never going to have one stops holding a listener open.
 */
const PATIENCE = 15_000

/**
 * How long the conversation region is waited for before the whole repository
 * content will do instead.
 *
 * Short, because on the path where this matters the region is frequently never
 * rendered at all. GitHub's own navigation from a list to a pull request stalls
 * after the response arrives — measured with this extension disabled entirely,
 * so it is theirs and not ours — and the page keeps the list's markup under a
 * pull request's address indefinitely. Waiting politely for a region nobody is
 * building was two and a half seconds of the reader's time, every time.
 *
 * Long enough only to not mistake a half-swapped page for a finished one. The
 * observer below keeps looking afterwards and moves the interface into the
 * conversation region if GitHub does eventually produce one.
 */
const SETTLING = 600

const whenSlotAppears = (
  target: Document,
  patience: number,
  settling: number
): Promise<Element | null> => {
  // Whether it is yet fair to conclude there is no conversation region.
  //
  // A finished document used to be the whole test, and on a page load it is a
  // good one: GitHub sends the region in the HTML, so a parsed document without
  // one has none. It is worthless on a soft navigation. The document finished
  // loading minutes ago as somebody's list of pull requests, so every test of
  // it passes instantly, and the interface takes the whole repository content —
  // inside a turbo-frame, which Turbo then replaces, carrying the interface off
  // the page and leaving the rule that hides GitHub's conversation with nothing
  // in front of it. A blank page, in other words.
  //
  // So the wait is also made to be a real one.
  let mayFallBack = false

  const look = (): Element | null =>
    mayFallBack ? findSlot(target) : findConversationSlot(target)

  const conversation = findConversationSlot(target)
  if (conversation !== null) return Promise.resolve(conversation)

  return new Promise((resolve) => {
    const finish = (found: Element | null) => {
      clearTimeout(timer)
      clearTimeout(grace)
      watcher.disconnect()
      target.removeEventListener("DOMContentLoaded", allow)
      resolve(found)
    }
    const check = () => {
      const found = look()
      if (found !== null) finish(found)
    }
    const allow = () => {
      if (target.readyState === "loading") return
      mayFallBack = true
      check()
    }

    const watcher = new MutationObserver(check)
    const timer = setTimeout(() => finish(null), patience)
    // Long enough for GitHub to fetch a pull request and render it, which is
    // the only thing that distinguishes "not here yet" from "not coming".
    const grace = setTimeout(allow, settling)
    target.addEventListener("DOMContentLoaded", check)
    watcher.observe(target.documentElement, { childList: true, subtree: true })
  })
}

export type Takeover = {
  /** Where to render. Already in the page. */
  readonly container: Element
  /** Gives the page back: GitHub's conversation returns and ours leaves. */
  readonly stepAside: () => void
}

/**
 * Puts the interface where GitHub's conversation was.
 *
 * Their content is hidden rather than removed. React is still mounted on it and
 * still updating it; deleting nodes from underneath a live tree earns a crash
 * at the worst moment, and hiding costs nothing. It also means the conversation
 * is one attribute away when this has to step aside — which is what it does
 * when a pull request cannot be read.
 *
 * Returns null when the slot cannot be found, which is the honest outcome if
 * GitHub reorganises the page: better their working conversation than our
 * interface nailed to the wrong element.
 */
export const takeOverSlot = (
  target: Document,
  // Whatever ran before us got here first; there is one interface per page.
  container: Element = interfaceContainer(target)
): Takeover | null => {
  const slot = findSlot(target)
  if (slot === null) return null

  container.id = ROOT_ID

  const settle = (into: Element): void => {
    into.append(container)
    hideTheirs(into, container)
    hideTheirHeader(target)
    // Set before revealing, so that the rule keeping their conversation out of
    // sight is never off for an instant. The attribute hiding above says what
    // to do about the children that are there now; this says what to do about
    // every child React inserts afterwards, which is the same thing, decided in
    // advance rather than a mutation late.
    target.documentElement.setAttribute(TAKEN, "")
    reveal(target)
    ungate(target)
  }
  settle(slot)

  // React does not re-render this region so much as replace it: the element the
  // interface was appended to is thrown away and an identical one takes its
  // place, with our container still attached to the discarded copy. Watching the
  // slot itself would mean watching a node no longer on the page, so this
  // watches something above it that survives — and re-finds the slot each time,
  // rather than trusting the one it started with.
  //
  // The body, and nothing nearer. Everything between it and the slot is
  // something Turbo replaces wholesale on a navigation, and an observer on a
  // replaced node is an observer of a node no longer in the document: it never
  // fires again, so the interface is never put back, and the page stays blank
  // behind a rule that is still hiding GitHub's.
  const ground = target.body
  const watcher = new MutationObserver(() => {
    if (!container.isConnected) {
      const fresh = findSlot(target)
      if (fresh !== null) settle(fresh)
      return
    }

    // Moving up, when the conversation region turns up late.
    //
    // The wait above is deliberately short, so on a slow page the interface
    // goes into the whole repository content and is on the screen quickly.
    // That is the right trade for a reader and the wrong place to stay: if
    // GitHub does render a conversation after all, this is where the interface
    // moves into it. React does not mind being re-parented — the same nodes,
    // one level down — and nothing has to be drawn again.
    const better = findConversationSlot(target)
    if (better !== null && container.parentElement !== better) {
      settle(better)
      return
    }

    const parent = container.parentElement
    if (parent !== null) hideTheirs(parent, container)
    hideTheirHeader(target)
  })
  watcher.observe(ground, { childList: true, subtree: true })

  return {
    container,
    stepAside: () => {
      watcher.disconnect()
      target.documentElement.removeAttribute(TAKEN)
      container.remove()
      // Everything hidden anywhere, not only within the slot: their tab row
      // lives in the header above it and has to come back too.
      for (const theirs of target.querySelectorAll(`[${HIDDEN}]`)) {
        theirs.removeAttribute("hidden")
        theirs.removeAttribute(HIDDEN)
      }
    }
  }
}

/**
 * Takes over as soon as GitHub has parsed somewhere to take over.
 *
 * Reveals the page when it cannot: a pull request this fails to recognise still
 * has GitHub's own conversation on it, and showing that is far better than
 * leaving the region hidden behind a rule nothing is ever going to lift.
 */
export const takeOverSlotWhenReady = async (
  target: Document,
  container: Element = interfaceContainer(target),
  patience: number = PATIENCE,
  settling: number = SETTLING
): Promise<Takeover | null> => {
  if ((await whenSlotAppears(target, patience, settling)) === null) {
    reveal(target)
    ungate(target)
    return null
  }

  const takeover = takeOverSlot(target, container)
  if (takeover === null) {
    reveal(target)
    ungate(target)
  }
  return takeover
}
