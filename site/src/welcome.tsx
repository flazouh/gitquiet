import "@fontsource-variable/inter"
import { BED_BEHIND, BED_COLOURS, BED_IN_CSS, INK } from "@/ui/bed"
import { Mark, Wordmark } from "@/ui/Mark"
import type { Shot } from "@/ui/onboarding/beats"
import { Tour } from "@/ui/onboarding/Tour"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { viewNamed } from "../../shots/views"
import { Bed } from "./Bed"
import { Live } from "./Live"
import "./index.css"
import "@/ui/onboarding.css"

const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

const MAC_AT =
  "https://github.com/flazouh/gitquiet/releases/latest/download/GitQuiet-macos-arm64.dmg"

/** Their own list of pull requests, which is the first page the extension redraws. */
const THEIR_PULLS = "https://github.com/pulls"

/**
 * How much of a screen a beat shows, in the screen's own pixels.
 *
 * Four hundred and sixty is the list down its first Court, or a pull request down to its
 * first file: in each case the part the beat is about.
 */
const DEEP = 460

/** Less, on the list, where the first group is the part the beat is about. */
const ROOM: Partial<Record<Shot, number>> = { "working-set": 400 }

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
 * The same four beats the app's first window shows, with one difference: here the
 * screens are mounted and running rather than photographed. They are the extension's
 * own components under fixture data, which is what this site has always drawn — a
 * picture of a screen is a claim about it, and a screen is the thing itself.
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

      <div className="relative z-1 mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col items-center justify-center gap-4 px-5 py-10">
        <a href="/" className="flex items-center gap-2" aria-label="GitQuiet">
          <Mark size={26} color={INK} />
          <Wordmark size={24} color={INK} />
        </a>

        {/*
          One sheet, no padding, clipped to its own radius: the tour's picture reaches
          all four edges of it. The same card the app's window draws.

          A height, not a floor under one, and the tour depends on it both ways. A card
          that grows by three hundred pixels on the press of Next is a card the reader
          has to find their place in again — and a card free to grow grew past the
          window, because a screen is eight hundred pixels tall and asked for all of
          them. Told how tall it is, it gives the picture what the words leave.
        */}
        <div className="flex h-[min(660px,calc(100dvh-150px))] w-full flex-col overflow-hidden rounded-[14px] bg-white/80 shadow-[inset_0_0_0_1px_rgba(27,23,37,0.06),0_1px_2px_rgba(27,23,37,0.05),0_24px_60px_-26px_rgba(27,23,37,0.24)] backdrop-blur-[12px]">
          <Tour
            /*
             * The top of the screen rather than all of it, and eager rather than when it
             * scrolls into view.
             *
             * The crop is the whole reason this reads: a screen is eight hundred pixels
             * tall, and showing all of it pushes the sentence explaining it off the
             * bottom of the window. A running screen scales itself to the width it is
             * given and cannot be squeezed to a height, so the crop is what makes it
             * fit — hence `ROOM`. `Live` holds a screen back until it is near the
             * viewport, which is right on a page carrying twelve of them and wrong here,
             * where there is one and it is the point.
             */
            show={(shot) => {
              const view = viewNamed(shot)
              if (view === undefined) return null

              const deep = ROOM[shot] ?? DEEP

              /*
               * Held to the height, at the shape of the crop.
               *
               * A running screen takes the width it is given and works out its own
               * height from it, so a holder that only limits its height cuts the bottom
               * off instead of making it smaller — which is what a short window did to
               * the Courts screen. Given the crop's own ratio, the width the screen
               * measures is a width whose height already fits.
               */
              return (
                <div
                  style={{
                    height: "100%",
                    maxWidth: "100%",
                    aspectRatio: `${view.width} / ${deep}`
                  }}
                >
                  <Live view={view} eager focus={{ x: 0, y: 0, width: view.width, height: deep }} />
                </div>
              )
            }}
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
