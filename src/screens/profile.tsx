import { Effect, Option } from "effect"
import { forgetIntent, intendedPath } from "@/app/intent"
import { theirWholeList } from "@/app/personRepos"
import { theirAnswering } from "@/app/profile"
import { loadWhereNoDocumentWasServed } from "@/app/softArrival"
import { anOrganisation } from "@/github/person"
import { chosenSettings } from "@/app/settings"
import {
  aScreen,
  handOverToGitHub,
  leaveTheirPages,
  takeTheWayBack,
  theSpotWas,
  withdrawTheWayBack
} from "@/shell/handOver"
import type { Answering } from "@/domain/answering"
import { type PersonPage, profileIn } from "@/domain/person"
import type { View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import { held, standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { theirColumn } from "./theirColumn"
import { markPage, reveal } from "@/ui/mount"
import { whenAddressChanges } from "@/ui/navigation"
import { PROFILE } from "@/ui/place"
import { type Owned, ProfileScreen } from "@/ui/ProfileScreen"
import "@/ui/styles.css"

/**
 * Puts one person's profile on the page, and hands back the way to take it off.
 *
 * Two reads, neither of which the other waits on. Their events answer whether they reply
 * to anybody, which is the question the page is arranged around, and their repositories
 * are the same walk their tab does. The column and the tab row are drawn before either
 * lands, because both are already in the document GitHub served.
 */
/**
 * How many pages of their list this page is worth.
 *
 * Their tab reads ten, because the whole list is what that page is for. This shows six
 * rows and four counts, one of their pages was measured at 307 kilobytes, and `useLive`
 * reads again every time the reader comes back to the tab — so three pages buys the
 * shape and the band says when it is over part of a longer list.
 */
const PAGES = 3

const open = (
  page: PersonPage,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const now = new Date()

  const asking = (partly: (said: Answering) => void) =>
    theirAnswering(page.login, now, partly).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  const listing = (partly: (owned: Owned) => void) =>
    theirWholeList(
      page,
      document,
      (list) => partly({ rows: list.rows, reading: true, capped: list.capped }),
      PAGES
    ).pipe(
      throughGitHub,
      Effect.map((list): Owned => ({ rows: list.rows, reading: false, capped: list.capped })),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /*
   * Both started before anything is waited on, as on the repositories tab: reading their
   * events and waiting for GitHub to render a frame to stand in have nothing to say to
   * each other. See `held`.
   */
  const answering = held(asking)
  const owned = held(listing)

  /*
   * Their column, where the press that brought the reader here loaded no document and
   * there is none on the page to read. Built once rather than per draw, so the screen is
   * handed the same reader of it every time it renders. See `theirColumn`.
   */
  // An organisation, found on a press that loaded no document. Their server serves it.
  const column = theirColumn(page, () => loadWhereNoDocumentWasServed(window, at))

  return standAScreen({
    place: PROFILE,
    draw: (standing) => (
      <ProfileScreen
        at={at}
        login={page.login}
        answering={answering}
        owned={owned}
        elsewhere={column}
        onStepAside={standing.stepAside}
        now={now}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from: see
 * `src/entrypoints/shell.content.ts`.
 */
export const start = (): void => {
  // First and synchronous, because the rules that hide their page are written per page
  // and hang on this attribute. A frame late is a frame of their page on the screen.
  markPage(document, PROFILE)


  const store = settings()
  /** This screen, so the way back it puts up is not taken down by another. */
  const me = aScreen("profile")

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"
  // Kept current, because another screen can change it: "Leave GitQuiet" on a pull
  // request, then their own link to a list, drew our list over a page the reader left.
  store.watch((changed) => {
    view = changed.page.view
  })

  const show = (url: string): void => {
    const page = profileIn(url)

    // One of their other tabs, or somewhere else entirely. The stylesheet gates this
    // address and cannot read a URL, so handing the page back is the first thing to do.
    if (Option.isNone(page)) {
      close()
      close = () => {}
      on = undefined
      leaveTheirPages(document, me)
      return
    }

    if (on === page.value.login) return

    close()
    close = () => {}
    on = undefined

    /*
     * An organisation's page, served under the same one-segment address as a person's.
     * Theirs to draw: nothing here reads an organisation. Asked again once the document
     * is parsed, below, because this can run before the tag that says so has arrived.
     */
    if (anOrganisation(document)) {
      leaveTheirPages(document, me)
      return
    }

    // Their page, because that is what was asked for last time — with the way back
    // on it, because a page that hands over and offers nothing is a door that only
    // opens one way.
    if (view === "github") {
      handOverToGitHub(store, document, me, takeBack)
      return
    }

    withdrawTheWayBack(me)

    close = open(page.value, new URL(url, window.location.origin).pathname)
    on = page.value.login
  }

  /*
   * The address and not the path, as on their repositories tab: all three of a person's
   * pages are one path and differ in the query alone. See `whenAddressChanges`.
   */
  /** Pressed on GitHub's page: ours from here on, starting with this one. */
  function takeBack(): void {
    view = "ours"
    takeTheWayBack(store, document, me)
    show(window.location.href)
  }

  whenAddressChanges(window, () => show(window.location.href))

  // The same question once the document is parsed. See the organisation in `show`.
  const askAgainIfAnOrganisation = (): void => {
    if (!anOrganisation(document) || on === undefined) return
    on = undefined
    show(window.location.href)
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", askAgainIfAnOrganisation, { once: true })

  Effect.runFork(
    chosenSettings(store).pipe(
      Effect.map((chosen) => {
        view = chosen.page.view
        theSpotWas(chosen.wayBack)

        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(profileIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(profileIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
