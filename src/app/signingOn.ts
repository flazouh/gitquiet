/**
 * Whether to answer an organisation's single sign-on for the reader, or to draw
 * the card and let them answer it.
 *
 * Two facts decide it and they pull opposite ways. The reader may have asked for
 * this to happen by itself, which is the whole point of the setting. And the last
 * time it happened by itself may have been a second ago — because their provider
 * sent the reader straight back to the wall, which is what a lapsed provider
 * session looks like from here. Posting again on that page is a loop with no
 * frames in it, and the reader would watch the address flicker until they closed
 * the tab.
 *
 * So: by itself, but once per organisation per {@link ROUND_AGAIN}. The second
 * wall inside that window draws the card instead, which says what happened and
 * leaves the button where the reader can press it.
 */

import { Option, UndefinedOr } from "effect"
import type { Settings } from "../domain/Settings"
import { type Wall, wallIn } from "../github/signOn"

/**
 * How long an automatic answer stands before another one is allowed.
 *
 * Long enough to be sure a bounce is a bounce: the round trip through a provider
 * that still has a session is a redirect chain and takes about a second, so a
 * second wall arriving inside half a minute is not the reader arriving at a new
 * page. Short enough that a session which really does lapse twice in a sitting is
 * answered both times.
 */
export const ROUND_AGAIN = 30_000

/**
 * What was done a moment ago and by whom, kept for as long as the tab is open.
 *
 * Not in the settings store, deliberately. This is not a choice and it is worth
 * nothing tomorrow — it exists to recognise a loop that is happening now, and a
 * loop cannot outlive the tab it is looping in.
 */
export type Lately = {
  /** When this organisation was last answered here, or nothing. */
  readonly when: (organisation: string) => number | undefined
  readonly note: (organisation: string, at: number) => void
}

/** Where it is kept, which is the tab's own storage and nowhere else. */
const KEY = (organisation: string): string => `gitquiet:signed-on:${organisation}`

/** Storage, which throws rather than answers where a profile has switched it off. */
const reading = UndefinedOr.liftThrowable((store: Storage, key: string) =>
  store.getItem(key) ?? undefined
)
const writing = UndefinedOr.liftThrowable((store: Storage, key: string, value: string) =>
  store.setItem(key, value)
)

/**
 * The tab's memory, over whatever storage it has, or over none.
 *
 * Nothing here is required to work. Storage throws rather than answers in a
 * private window and behind some managed profiles, and reaching for the property
 * at all throws in a few of those — which is why the absence is a value this
 * takes rather than a failure it catches. A reader whose browser will not remember
 * this gets the card every time, which is the safe half of the trade: the loop
 * this guards against is one the card already breaks.
 */
export const inSession = (store: Storage | undefined): Lately => ({
  when: (organisation) => {
    if (store === undefined) return undefined

    const kept = reading(store, KEY(organisation))
    if (kept === undefined) return undefined

    // Anything else in there was not written by this. Read as never rather than
    // as now, so a spoiled value asks the reader instead of blocking them.
    const at = Number(kept)
    return Number.isFinite(at) ? at : undefined
  },
  note: (organisation, at) => {
    // A tab that cannot remember asks the reader instead. See above.
    if (store !== undefined) writing(store, KEY(organisation), String(at))
  }
})

/**
 * What a page that may be their wall gets: the reader, the form, or GitHub back.
 *
 * One answer rather than several questions asked in a row. It was three — is this
 * really the wall, did the reader ask for our pages at all, would this answer
 * itself, and then a fourth defined as the negation of the third — computed in the
 * screen and passed to the card as separate props. Two costs. The guard ran twice
 * per page. And a card could be built saying the reader never switched this on
 * *and* that it did not happen because it was switched on a moment ago, which is
 * not a wall that exists.
 *
 * - `hand back`: not the wall at all, or a reader who asked for GitHub's own
 *   pages. Their page, untouched, either way.
 * - `answer`: their form, posted without a press, because that is what the reader
 *   asked for and nothing says it has just been tried.
 * - `ask`: the card. `cameRound` is true where the reader did ask for it to be
 *   automatic and this wall came back inside {@link ROUND_AGAIN} anyway — their
 *   provider wants to see them, so the card says so rather than looking broken.
 */
export type Doing =
  | { readonly go: "hand back" }
  | { readonly go: "answer"; readonly wall: Wall }
  | { readonly go: "ask"; readonly wall: Wall; readonly cameRound: boolean }

const HAND_BACK: Doing = { go: "hand back" }

export const whatTheWallGets = (
  page: Document,
  settings: Settings,
  lately: Lately,
  now: number
): Doing => {
  const wall = wallIn(page)

  /*
   * Their login page, their second factor, their device check. Every one of those
   * carries the same root class this screen was started by and is a page the
   * reader has to be able to use, and this has nothing to put in front of any of
   * them.
   */
  if (Option.isNone(wall)) return HAND_BACK

  /*
   * A reader who asked for GitHub's own pages gets GitHub's own wall. That setting
   * is the one switch in this product that means "leave their site alone", and a
   * wall is still their site.
   */
  if (settings.page.view === "github") return HAND_BACK

  if (settings.signOn.byItself !== "always") return { go: "ask", wall: wall.value, cameRound: false }

  const last = lately.when(wall.value.organisation)
  return last === undefined || now - last >= ROUND_AGAIN
    ? { go: "answer", wall: wall.value }
    : { go: "ask", wall: wall.value, cameRound: true }
}
