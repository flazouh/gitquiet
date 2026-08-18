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

/** What every screen module exports: put yourself on this page and stay there. */
export type Screen = { readonly start: () => void }

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
  | "run"
  | "actions"
  | "releases"
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
  /**
   * The odd one, and the only one here that is not a page of GitHub's at all.
   *
   * Every other name in this list is an address. This one is a state a page can be
   * in: an organisation's single sign-on served in place of whatever was asked for,
   * under that page's own URL. So the shell picks it by reading the document rather
   * than by reading the address — see `SIGN_ON` in `src/ui/place.ts`.
   */
  | "sign-on"

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
  "run",
  "actions",
  "releases",
  "notifications",
  "person-repos",
  "profile",
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
const dressed = (at: string): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    const ready = () => resume(Effect.void)
    const url = urlOf(at)
    if (document.querySelector(`link[href="${url}"]`) !== null) return ready()

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
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
