import { Effect, Option } from "effect"
import { defineContentScript } from "wxt/utils/define-content-script"
import { openHere } from "@/app/injection"
import { intendTo } from "@/app/intent"
import { loadPullRequest } from "@/app/pullRequest"
import { fromPathname, type PullRequestRef } from "@/domain/PullRequestRef"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { initialiseErrorReporting } from "@/observability/sentry"
import { ROOT_ID } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import "@/ui/softgate.css"

/**
 * How long a pointer has to rest on a link before it counts as interest.
 *
 * Somebody moving the pointer across a list of pull requests on the way to
 * something else crosses a dozen links in far less than this. Somebody who has
 * decided which one they want stops on it, and then takes another two hundred
 * milliseconds or so to press the button — which is the window this is buying.
 */
const DWELL = 150

/**
 * How many pull requests one visit to one page will read ahead.
 *
 * Reading a pull request is four requests to GitHub, made with the reader's own
 * session. A list they linger over should not turn into a hundred of them.
 */
const AT_MOST = 12

/**
 * How long the conversation is held back before giving up on the interface.
 *
 * Only reached when the worker never answers — it was asleep and stayed asleep,
 * the injection was refused, the extension was reloaded underneath the page. In
 * every one of those cases GitHub's own conversation is the right thing to
 * show, and the reader should not be looking at a gap while we work that out.
 */
const GIVE_UP = 8_000

/** Set while a pull request is being navigated to and the interface is not up yet. */
const GATING = "data-githubpro-gating"

const sameReference = (left: PullRequestRef, right: PullRequestRef): boolean =>
  left.owner === right.owner && left.repo === right.repo && left.number === right.number

/**
 * Reads a pull request ahead of being asked for it, so that opening it is a
 * storage read rather than a page load.
 *
 * There is nothing here about caching, because reading is what fills the store:
 * the gateway keeps what it decodes. Warming a pull request and opening one are
 * the same call, and the only difference is who asked.
 */
export default defineContentScript({
  // Every GitHub page, not only pull requests: the links worth reading ahead
  // are on the list, the dashboard and the notifications inbox, which is to say
  // everywhere except the page the reader has already arrived at.
  matches: ["*://github.com/*"],
  runAt: "document_idle",
  main() {
    initialiseErrorReporting("prefetch")

    // The one already open. Reading it ahead would be a race with the page
    // reading it for real, for a result nobody is going to wait for.
    const here = fromPathname(window.location.pathname)

    const asked = new Set<string>()
    let reading = false

    const warm = async (reference: PullRequestRef): Promise<void> => {
      // One at a time. A reader sweeping a list would otherwise have four
      // requests in flight per link they passed over, and GitHub is entitled to
      // think less of us for it.
      if (reading) return
      reading = true
      try {
        await Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(gatewayLayer)))
      } catch {
        // Nobody asked for this and nobody is waiting for it. A pull request
        // that could not be read ahead is read again, out loud, when it is
        // opened — and that is where saying so belongs.
      } finally {
        reading = false
      }
    }

    const wanted = (target: EventTarget | null): PullRequestRef | null => {
      if (!(target instanceof Element)) return null

      const link = target.closest("a")
      if (link === null || link.hostname !== window.location.hostname) return null

      const reference = fromPathname(link.pathname)
      if (Option.isNone(reference)) return null
      if (Option.isSome(here) && sameReference(here.value, reference.value)) return null

      return reference.value
    }

    let dwelling: ReturnType<typeof setTimeout> | undefined

    document.addEventListener(
      "pointerover",
      (event) => {
        if (asked.size >= AT_MOST) return

        const reference = wanted(event.target)
        if (reference === null) return

        const key = `${reference.owner}/${reference.repo}/${reference.number}`
        if (asked.has(key)) return

        clearTimeout(dwelling)
        dwelling = setTimeout(() => {
          asked.add(key)
          void warm(reference)
        }, DWELL)
      },
      { passive: true }
    )

    document.addEventListener("pointerout", () => clearTimeout(dwelling), { passive: true })

    // A document that loaded on a pull request already has the interface's
    // script in it, and that script follows GitHub around by itself. Asking for
    // a second copy would be answered — the copy declines on arrival — but the
    // request is pure noise, so it is never made.
    let injected = /\/pull\//.test(window.location.pathname)
    let givingUp: ReturnType<typeof setTimeout> | undefined

    const ungate = (): void => {
      document.documentElement.removeAttribute(GATING)
      clearTimeout(givingUp)
    }

    /**
     * Holds GitHub's conversation back and asks for the interface.
     *
     * Both halves are wanted as early as possible and for the same reason: the
     * script is nine hundred kilobytes and the reader is watching. Called on
     * the press rather than the navigation, so the fetch and the parse happen
     * while GitHub is still assembling the page.
     */
    const open = (going?: string): void => {
      // Already up, and following GitHub around by itself. Gating now would
      // hide the region the interface is standing in, which is to say the
      // interface — and nothing would lift it, because the give-up below sees
      // an interface on the page and concludes all is well.
      if (document.getElementById(ROOT_ID) !== null) return

      // Said before the interface is asked for, so that it is already there to
      // be read the instant the script starts — which is about a tenth of a
      // second later, and a full second before the address agrees.
      if (going !== undefined) intendTo(window, going)

      document.documentElement.setAttribute(GATING, "")

      clearTimeout(givingUp)
      givingUp = setTimeout(() => {
        // Unless it arrived, in which case it is in charge of its own gate.
        if (document.getElementById(ROOT_ID) === null) ungate()
      }, GIVE_UP)

      if (injected) return
      injected = true

      void browser.runtime.sendMessage(openHere).catch(() => {
        // No worker, or it could not inject. Their conversation it is.
        injected = false
        ungate()
      })
    }

    const pressed = (event: Event): void => {
      const mouse = event as MouseEvent

      // A plain press only. Anything held down turns this into a new tab, a new
      // window or a download, and the page stays exactly where it is — so
      // taking it over would replace a list the reader is still looking at.
      if (mouse.button !== undefined && mouse.button !== 0) return
      if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest("a")
      if (link === null || wanted(target) === null) return

      open(link.pathname)
    }

    // All three, because the gate has to be up before GitHub renders and no one
    // of them can be relied on to say so. A pointer fires all three in order; a
    // keyboard fires only the last; and automation, synthetic clicks and the
    // odd browser skip whichever they like. Asking twice costs an attribute
    // that is already set and a message that is never sent again.
    for (const name of ["pointerdown", "mousedown", "click"]) {
      document.addEventListener(name, pressed, { passive: true, capture: true })
    }

    // The presses this misses: the back button, a middle-click promoted to this
    // tab, anything GitHub navigates on its own account. Later than a press —
    // the page is already changing — but still before their conversation has
    // been rendered into the region that is about to be hidden.
    whenLocationChanges(window, (path) => {
      if (Option.isSome(fromPathname(path))) open()
      else ungate()
    })
  }
})
