/**
 * Fetching the interface for a page, which is the whole of what the worker used to
 * be for.
 *
 * A content script is started when a document loads that matches it, and GitHub
 * does not load documents: every press of a pull request, of their "Pull requests"
 * nav, of a repository's own tab swaps the page in place. So five of these six
 * pages could never be caught by a match, and the way one arrived was a message to
 * the extension's worker asking it to inject the script. That ask costs whatever
 * the worker takes to wake — measured at 587 milliseconds of GitHub's own list on
 * the screen with a cold one — and it can fail outright when the extension has just
 * been updated underneath the page.
 *
 * A module can simply be imported. `scripts/build-screens.ts` builds each screen as
 * an extension file and the manifest publishes them, so this is a fetch from disk
 * with nobody to wake and nobody to ask. The pattern is the diff renderer's, which
 * has loaded that way all along.
 */

import { type Cause, Effect } from "effect"
import { onwardWith } from "@/observability/report"
import { OUTSIDE } from "@/ui/mount"
import { dressShadow, keepTheirStylesOff, theHost, theSheet } from "@/ui/theHost"

/** What every screen module exports: take the page, and optionally build one route ahead. */
export type Screen = {
  readonly start: () => void
  readonly prepare?: (path: string) => void
}

/** The pages this extension has a screen for. */
export type Wanted =
  | "pull-request"
  | "commit"
  | "commits"
  | "working-set"
  | "repo-pulls"
  | "repo-home"
  | "issue"
  | "repo-issues"
  | "raise"
  | "issues"
  | "blame"
  | "run"
  | "actions"
  | "releases"
  | "discussions"
  | "discussion"
  | "notifications"
  /**
   * A person's repositories tab, and their profile. Their stars is a place already —
   * `place.ts` claims all three of those addresses — and it is deliberately not here
   * yet: a name in this list is a file to import, and a page named for a file that
   * does not exist is a gate raised over a screen that never comes. Until it has its
   * screen GitHub keeps that page, which is what the shell does with a place no screen
   * answers for.
   */
  | "person-repos"
  | "profile"
  /** Two refs compared, which is how a pull request starts. */
  | "compare"
  /**
   * The odd one, and the only one here that is not a page of GitHub's at all.
   *
   * Every other name in this list is an address. This one is a state a page can be
   * in: an organisation's single sign-on served in place of whatever was asked for,
   * under that page's own URL. So the shell picks it by reading the document rather
   * than by reading the address — see `SIGN_ON` in `src/ui/place.ts`.
   */
  | "sign-on"

/** Starts one long-lived screen kind once for the current document. */
export const startScreenOnce = (
  started: Set<Wanted>,
  what: Wanted,
  screen: Screen
): boolean => {
  if (started.has(what)) return false

  started.add(what)
  screen.start()
  return true
}

export const WANTED: ReadonlyArray<Wanted> = [
  "pull-request",
  "commit",
  "commits",
  "working-set",
  "repo-pulls",
  "repo-home",
  "issue",
  "repo-issues",
  "raise",
  "issues",
  "blame",
  "run",
  "actions",
  "releases",
  "discussions",
  "discussion",
  "notifications",
  "person-repos",
  "profile",
  "compare",
  "sign-on"
]

export const isWanted = (what: string): what is Wanted =>
  WANTED.includes(what as Wanted)

/**
 * Where in the extension a file published by `scripts/build-screens.ts` really is.
 *
 * The cast is of the function rather than of the paths handed to it, which is where
 * the inaccuracy actually is: WXT types this to the files it found in `public` the
 * last time it generated types, and these are written into `public/screens` by a
 * script of ours it knows nothing about. Whether they are there is a question for
 * the build, and `bun run build` writes them before WXT reads that folder.
 */
const urlOf = (path: string): string =>
  (browser.runtime.getURL as (at: string) => string)(path)

/**
 * One stylesheet for all five, because there is one: every screen imports the same
 * `styles.css`, so the build emits it once and the second screen a reader opens
 * finds it already on the page.
 */
const STYLES = "/screens/styles.css"

export const fileOf = (what: Wanted): { readonly script: string; readonly styles: string } => ({
  script: `/screens/${what}.js`,
  styles: STYLES
})

/** Lets Chromium fetch and compile a screen before navigation needs its exports. */
export const preloadScreen = (what: Wanted): boolean => {
  const href = urlOf(fileOf(what).script)
  if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`) !== null) return false

  const link = document.createElement("link")
  link.rel = "modulepreload"
  link.href = href
  ;(document.head ?? document.documentElement).append(link)
  return true
}

/**
 * The stylesheet, put on the page beside the script rather than inside it.
 *
 * A screen's CSS is its own file — Tailwind's utilities, the motion tokens, the
 * rules that hide GitHub's page — and it is deliberately not in the shell's own
 * manifest entry: the shell is on every page of GitHub, and their site uses class
 * names Tailwind also uses. `.px-3` means sixteen pixels to Primer and twelve to us,
 * and unlayered rules of equal specificity are settled by which sheet came last. So
 * these arrive with the screen that needs them and nowhere else.
 *
 * Resolves when the sheet is really in force. A screen rendered against a
 * stylesheet still in flight is one frame of unstyled interface, which is worse
 * than the frame of nothing it replaced.
 */
const linked = (at: string): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    const ready = () => resume(Effect.void)
    const url = urlOf(at)
    if (document.querySelector(`link[href="${url}"]`) !== null) return ready()

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
    /*
     * Marked as ours, because `theirStyles` has to be able to tell.
     *
     * It turns every stylesheet in the document off while we hold the page, and
     * it knew ours by the scheme its address begins with — which is
     * `chrome-extension://` on Chrome and `moz-extension://` on Firefox and
     * `safari-web-extension://` on Safari. So on two of the three browsers this
     * extension ships to, the first thing it did on taking a page was switch off
     * its own stylesheet: the bar came out as raw HTML, its controls wearing the
     * platform's own borders, its rows stacked down the left edge because no
     * `flex` ever reached them. The screens were unharmed, being dressed by a
     * constructed sheet inside the shadow root rather than by this link, which is
     * what made it look like a bar problem.
     *
     * The mark says whose it is outright, so nothing has to be inferred from a
     * URL. `theirStyles` reads it first for exactly that reason.
     */
    link.setAttribute(OUTSIDE, "")
    /*
     * Wherever there is to put it. This runs at `document_start`, where there is no
     * `document.head` yet — the parser has produced the root element and nothing
     * else, and reading `.append` off the head that is not there was three of the
     * four screens failing to load at all, on a page that then had nothing on it.
     *
     * A stylesheet applies from anywhere in the document, so the root element will
     * do, and the parser leaves a node that is already there where it is.
     */
    const where = document.head ?? document.documentElement
    // Either way. A sheet that will not load is not a reason to withhold the
    // interface: the screen's own failsafe hands the page back if it comes to that,
    // and an unstyled interface is still an interface.
    link.addEventListener("load", () => ready())
    link.addEventListener("error", () => ready())
    where.append(link)
  })

/**
 * The same sheet, twice: into their document and into our shadow root.
 *
 * A `<link>` in the document styles nothing inside a shadow root — that is the
 * whole point of the boundary — so the interface would paint unstyled without the
 * second half. The link stays because it is what dresses the screens that run as
 * documents of their own, and because anything of ours still standing in `body`
 * reads it.
 *
 * A sheet that will not build is reported and stepped past, on the same reasoning
 * the link's own failure is: an unstyled interface is still an interface, and the
 * screen's failsafe hands the page back if it comes to worse than that.
 */
const dressed = (at: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const url = urlOf(at)
    yield* linked(at)

    const built = yield* theSheet(url).pipe(Effect.catch(onwardWith(null)))
    if (built === null) return

    dressShadow(theHost(document).shadow, built)

    /*
     * And only now are their sheets worth turning off.
     *
     * The saving is real and it is not worth a page with no styles on it at all.
     * `markPage` asks for this at `document_start`, before ours has been fetched,
     * and the ask is refused until this line has run — see `oursInForce`.
     */
    keepTheirStylesOff(document)
  })

const held = new Map<Wanted, Screen>()

/**
 * Fetches a screen, and hands back the one already fetched afterwards.
 *
 * The browser holds the module itself, so a second import of the same URL costs
 * nothing; what is held here is the surface, so a second press does not wait on a
 * fetch that has already happened. A failure is not held, so a screen that could not
 * be fetched once can be asked for again.
 *
 * The stylesheet is waited for beside the script rather than after it. Both are
 * extension files and the sheet is the smaller of the two, so the wait costs nothing
 * — and a screen rendered against a stylesheet still in flight is a frame of
 * unstyled interface, which is worse than the frame of nothing it replaced.
 */
export const screenFor = (what: Wanted): Effect.Effect<Screen, Cause.UnknownError> =>
  Effect.suspend(() => {
    const had = held.get(what)
    if (had !== undefined) return Effect.succeed(had)

    const file = fileOf(what)
    return Effect.all(
      [
        dressed(file.styles),
        Effect.tryPromise(() =>
          // Ignored by the bundler on purpose: this is an extension URL, and a content
          // script's own relative imports resolve against github.com, where none of
          // these files exist and would not be allowed to.
          import(/* @vite-ignore */ urlOf(file.script))
        )
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.map(([, module]) => module as Screen),
      Effect.tap((screen) =>
        Effect.sync(() => {
          held.set(what, screen)
        })
      )
    )
  })
