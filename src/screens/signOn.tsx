import { Effect, UndefinedOr } from "effect"
import { chosenSettings } from "@/app/settings"
import { inSession, whatTheWallGets } from "@/app/signingOn"
import { theirFormAgain, type Wall } from "@/github/signOn"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings } from "@/shell/supplied"
import { handBack, markPage } from "@/ui/mount"
import { SIGN_ON } from "@/ui/place"
import { SignOn } from "@/ui/SignOn"
import { useSettings } from "@/ui/useSettings"
import "@/ui/styles.css"

/**
 * Where the tab remembers what it did a moment ago.
 *
 * A function rather than the value, because a browser that refuses storage throws
 * on the property itself rather than on the call — a private window, and some
 * managed profiles. `inSession` swallows the rest.
 */
const thisTab = UndefinedOr.liftThrowable(() => window.sessionStorage)

/**
 * Their wall, once their markup exists to read.
 *
 * The screen is fetched at `document_start`, where the root element carries the
 * class this page was recognised by and nothing else has been parsed. Their wall
 * is one small server-rendered page, so the wait is a few milliseconds — and it is
 * a wait rather than an observer because there is exactly one thing to see and no
 * reason to watch for a second.
 */
const whenParsed = (then: () => void): void => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", then, { once: true })
    return
  }
  then()
}

/**
 * Posts what their Continue button posts, and says so before it does.
 *
 * Noted first, because posting navigates: an attempt written down after the
 * request went out is an attempt that is never written down at all, and the loop
 * guard would then have nothing to guard with.
 */
const answerIt = (wall: Wall): void => {
  inSession(thisTab()).note(wall.organisation, Date.now())
  theirFormAgain(document, wall).submit()
}

/**
 * How long a post made on nobody's behalf is given to become a navigation.
 *
 * Generous, because what is being waited for is the request leaving rather than
 * their provider answering: the moment it is answered this document is gone, and
 * a document that is gone has no timers.
 *
 * It also covers the tab that comes back out of the browser's cache with the gate
 * still up. A frozen timer resumes on restore, so the page is handed back a moment
 * later rather than staying blank.
 */
const GIVE_UP_POSTING = 4000

/**
 * Answers the wall with nothing drawn, and keeps the way back out of it.
 *
 * The one path here where a reader is looking at no interface at all: their wall
 * is held back by the rules this page's name carries and this screen draws nothing
 * over it, because in a second there will be another page. Where the post goes
 * nowhere — no network, a provider that is down — that second never ends, and the
 * setting a reader turned on to save a click has cost them the page instead.
 *
 * So a timer, which a post that navigates takes with the document. Their wall and
 * their own button are worth more than our blank page.
 */
const answerItAlone = (wall: Wall): void => {
  answerIt(wall)
  setTimeout(() => handBack(document), GIVE_UP_POSTING)
}

/**
 * The card, joined to the store the tick on it writes to.
 *
 * A component rather than a value read in `start`, because the tick has to be
 * shown as it is now and not as it was when this page loaded — a reader who ticks
 * it and then presses Continue should see the tick, and a second tab of theirs
 * should agree. `useSettings` is watching the store for both.
 *
 * The tick changes the next wall and never this one, deliberately. A reader who
 * means "and get on with it" has the button beside it.
 */
const Card = ({
  wall,
  cameRound,
  onStepAside
}: {
  readonly wall: Wall
  readonly cameRound: boolean
  readonly onStepAside: () => void
}) => {
  const { settings: stored, change } = useSettings()

  return (
    <SignOn
      wall={wall}
      chosen={stored.signOn.byItself}
      onChoose={(next) =>
        change((current) => ({ ...current, signOn: { ...current.signOn, byItself: next } }))
      }
      cameRound={cameRound}
      onContinue={() => answerIt(wall)}
      onStepAside={onStepAside}
    />
  )
}

const open = (wall: Wall, cameRound: boolean): (() => void) =>
  standAScreen({
    place: SIGN_ON,
    draw: (standing) => (
      <Card wall={wall} cameRound={cameRound} onStepAside={standing.stepAside} />
    )
  }).close

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell when the page the reader landed on looks like one of
 * GitHub's auth pages. Looks like, rather than is: the class that got this far is
 * on their login box and their second factor too, and neither of those is this
 * screen's business. The reading below is what settles it, and handing the page
 * back is what it does when the answer is no.
 */
export const start = (): void => {
  // First and synchronous, as on every screen: the rules that hide their wall are
  // written per page and hang on this attribute.
  markPage(document, SIGN_ON)

  initialiseErrorReporting("sign-on")

  const store = settings()

  whenParsed(() => {
    Effect.runFork(
      chosenSettings(store).pipe(
        Effect.map((stored) => {
          const doing = whatTheWallGets(document, stored, inSession(thisTab()), Date.now())

          switch (doing.go) {
            case "hand back":
              handBack(document)
              return
            case "answer":
              answerItAlone(doing.wall)
              return
            case "ask":
              open(doing.wall, doing.cameRound)
          }
        }),
        Effect.tapError((error) => Effect.sync(() => reportError(error))),
        // Their wall rather than a blank page, whatever went wrong reading a
        // setting. It is a working page and this screen is an improvement on it,
        // not a replacement for it.
        Effect.catch(() => Effect.sync(() => handBack(document)))
      )
    )
  })
}
