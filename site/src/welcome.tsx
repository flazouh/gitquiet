import "@fontsource-variable/inter"
import { BED_BEHIND, BED_COLOURS, BED_IN_CSS, INK } from "@/ui/bed"
import { SETTINGS } from "@/ui/keeping"
import { Mark, Wordmark } from "@/ui/Mark"
import type { Shot } from "@/ui/onboarding/beats"
import { Held } from "@/ui/onboarding/Held"
import { Tour } from "@/ui/onboarding/Tour"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Supplied } from "../../shots/Supplied"
import { viewNamed } from "../../shots/views"
import { Bed } from "./Bed"
import "./index.css"
import "@/ui/onboarding.css"

/** Light, whatever the reader's own machine prefers: the card it stands in is white. */
const LIGHT = { [SETTINGS]: { theme: { appearance: "light", pack: "gitquiet" } } }

const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

const MAC_AT =
  "https://github.com/flazouh/gitquiet/releases/latest/download/GitQuiet-macos-arm64.dmg"

/** Their own list of pull requests, which is the first page the extension redraws. */
const THEIR_PULLS = "https://github.com/pulls"

/**
 * One screen in the tour's picture row, running, under this page's own fixture stage.
 *
 * `Held` measures the row and scales the screen into it, which is what the app's window
 * does with the same component. What is left here is what a page has to answer and a
 * window already has: `Supplied` is the stage every screen on this site runs under, and
 * `element` keeps its theme and its portalled bar inside the card rather than on `<html>`.
 *
 * Not `Live`, which the landing page uses. That draws the site's own bordered frame
 * around a screen and holds it back until it scrolls into view. Both are right in a
 * column of twelve screens and wrong here: this card is already the frame, and a frame
 * inside it is the double edge this panel was redrawn to get rid of.
 */
const Screen = ({ shot }: { readonly shot: Shot }) => {
  const view = viewNamed(shot)
  if (view === undefined) return null

  return (
    <Held view={view}>
      {(host) => (
        <Supplied chosen={{ ...view.chosen, ...LIGHT }} element={host}>
          {view.draw()}
        </Supplied>
      )}
    </Held>
  )
}

/**
 * Whether the extension sent the reader here, which it does once, on the install.
 *
 * Read off the address rather than asked of the browser: this page is served by the
 * site and cannot see what is installed. `?from=extension` is written by
 * `background.ts` and means one thing — there is nothing left to install, so the last
 * beat must not be a button back to the store they have this second come from.
 */
const fromTheExtension = (): boolean =>
  new URLSearchParams(window.location.search).get("from") === "extension"

/**
 * The onboarding, on the web, at `/welcome`.
 *
 * The same four beats the app's first window shows, drawn the same way: the screens are
 * mounted and running rather than photographed. They are the extension's own components
 * under fixture data, which is what this site has always drawn — a picture of a screen
 * is a claim about it, and a screen is the thing itself.
 *
 * Three ways in: the extension opens it on install, the landing page links to it for
 * anybody who wants the tour first, and the store listing points at it.
 */
const Welcome = () => {
  const already = fromTheExtension()

  return (
    <div className="relative min-h-dvh" style={BED_COLOURS}>
      {/*
        Fixed through `style` rather than through a class, because `Bed` writes
        `position: relative` into its own inline style and a class cannot outrank
        that.
        `z-index: 0` under content at `z-index: 1`, rather than the tidier-looking
        `-1`: a negative one puts the gradient behind the page's own background,
        which is paper, and paper is not see-through. The screen went white.
        `BED_IN_CSS` is the floor under the shader: without it this page is white
        until WebGL has compiled, and white for good on a machine with no WebGL.
      */}
      <Bed
        style={{ position: "fixed", inset: 0, zIndex: 0, background: BED_IN_CSS }}
        {...BED_BEHIND}
        alive
      />

      {/*
        In the corner of the page rather than over the card, which is the app's own first
        window: where a product puts its name is the top left.

        Outside the column below, and this is the whole point of it being out here. Inside
        it, `absolute` measured from a box capped at 1040 and centred — so on a wide window
        the name stood in the middle of the page with nothing under it.
      */}
      <a href="/" className="absolute top-6 left-6 z-2 flex items-center gap-2" aria-label="GitQuiet">
        <Mark size={26} color={INK} />
        <Wordmark size={24} color={INK} />
      </a>

      <div className="relative z-1 mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col items-center justify-center px-5 py-10">
        {/*
          One sheet, no padding, clipped to its own radius: the tour's picture reaches
          all four edges of it. The same card the app's window draws.

          A height, not a floor under one, and the tour depends on it both ways. A card
          that grows by three hundred pixels on the press of Next is a card the reader
          has to find their place in again — and a card free to grow grew past the
          window, because a screen is eight hundred pixels tall and asked for all of
          them. Told how tall it is, it gives the picture what the words leave.

          A hundred and twenty pixels of room around it, which is the page's own padding
          twice over. The lockup used to be counted in here as well; it stands in the
          corner now and takes none of the column.
        */}
        <div className="flex h-[min(660px,calc(100dvh-120px))] w-full flex-col overflow-hidden rounded-[14px] bg-white/80 shadow-[inset_0_0_0_1px_rgba(27,23,37,0.06),0_1px_2px_rgba(27,23,37,0.05),0_24px_60px_-26px_rgba(27,23,37,0.24)] backdrop-blur-[12px]">
          <Tour
            show={(shot) => <Screen shot={shot} />}
            ending={
              already
                ? {
                    title: "It is already working.",
                    says: ["Open any pull request on github.com. Nothing to set up, no account, no server."],
                    act: (
                      <a className="tour-press" href={THEIR_PULLS}>
                        Open your pull requests
                      </a>
                    )
                  }
                : {
                    title: "Add it to Chrome.",
                    says: ["It works on the pages you already use. There is a Mac app as well."],
                    act: (
                      <div className="flex flex-wrap items-center gap-2">
                        <a className="tour-press" href={STORE_AT}>
                          Add to Chrome
                        </a>
                        <a className="tour-quietly" href={MAC_AT}>
                          Download the Mac app
                        </a>
                      </div>
                    )
                  }
            }
          />
        </div>
      </div>
    </div>
  )
}

const page = document.getElementById("page")
if (page === null) throw new Error("#page is missing from welcome.html")

createRoot(page).render(
  <StrictMode>
    <Welcome />
  </StrictMode>
)
