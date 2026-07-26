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
const SLOTS = [
  'react-app[app-name="pull-requests"] [class*="PageLayoutContent"]',
  '[class*="PageLayoutContent"]',
  "#repo-content-pjax-container"
]

export const findSlot = (target: Document): Element | null => {
  for (const selector of SLOTS) {
    const found = target.querySelector(selector)
    if (found !== null) return found
  }
  return null
}

/** Marks what GitHub rendered into the slot, so it can be hidden again if it comes back. */
const HIDDEN = "data-githubpro-hidden"

const hideTheirs = (slot: Element, root: Element): void => {
  for (const child of slot.children) {
    if (child === root || child.hasAttribute(HIDDEN)) continue
    child.setAttribute(HIDDEN, "")
    child.setAttribute("hidden", "")
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

const whenSlotAppears = (target: Document, patience: number): Promise<Element | null> => {
  const already = findSlot(target)
  if (already !== null) return Promise.resolve(already)

  return new Promise((resolve) => {
    const finish = (found: Element | null) => {
      clearTimeout(timer)
      watcher.disconnect()
      resolve(found)
    }
    const watcher = new MutationObserver(() => {
      const found = findSlot(target)
      if (found !== null) finish(found)
    })
    const timer = setTimeout(() => finish(null), patience)
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
export const takeOverSlot = (target: Document): Takeover | null => {
  const slot = findSlot(target)
  if (slot === null) return null

  const container = target.createElement("div")
  container.id = ROOT_ID

  const settle = (into: Element): void => {
    into.append(container)
    hideTheirs(into, container)
  }
  settle(slot)

  // React does not re-render this region so much as replace it: the element the
  // interface was appended to is thrown away and an identical one takes its
  // place, with our container still attached to the discarded copy. Watching the
  // slot itself would mean watching a node no longer on the page, so this
  // watches something above it that survives — and re-finds the slot each time,
  // rather than trusting the one it started with.
  const ground = target.querySelector("#repo-content-pjax-container") ?? target.body
  const watcher = new MutationObserver(() => {
    if (!container.isConnected) {
      const fresh = findSlot(target)
      if (fresh !== null) settle(fresh)
      return
    }
    const parent = container.parentElement
    if (parent !== null) hideTheirs(parent, container)
  })
  watcher.observe(ground, { childList: true, subtree: true })

  return {
    container,
    stepAside: () => {
      watcher.disconnect()
      const parent = container.parentElement
      container.remove()
      for (const theirs of (parent ?? target).querySelectorAll(`[${HIDDEN}]`)) {
        theirs.removeAttribute("hidden")
        theirs.removeAttribute(HIDDEN)
      }
    }
  }
}

/** Takes over as soon as GitHub has rendered somewhere to take over. */
export const takeOverSlotWhenReady = async (
  target: Document,
  patience: number = PATIENCE
): Promise<Takeover | null> =>
  (await whenSlotAppears(target, patience)) === null ? null : takeOverSlot(target)
