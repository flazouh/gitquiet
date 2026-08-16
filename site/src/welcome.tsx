import "@fontsource-variable/inter"
import { Mark, Wordmark } from "@/ui/Mark"
import { Tour } from "@/ui/onboarding/Tour"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { viewNamed } from "../../shots/views"
import { Bed } from "./Bed"
import { INK } from "./brand"
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

/** Less, on the beat that names the four Courts under the picture and needs the room. */
const ROOM: Record<string, number> = { "working-set": 330 }

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
    <div className="relative min-h-dvh">
      {/*
        Fixed through `style` rather than through a class, because `Bed` writes
        `position: relative` into its own inline style and a class cannot outrank
        that.
        `z-index: 0` under content at `z-index: 1`, rather than the tidier-looking
        `-1`: a negative one puts the gradient behind the page's own background,
        which is paper, and paper is not see-through. The screen went white.
      */}
      <Bed style={{ position: "fixed", inset: 0, zIndex: 0 }} rotation={14} scale={1.45} alive />

      <div className="relative z-1 mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col items-center justify-center gap-4 px-5 py-10">
        <a href="/" className="flex items-center gap-2" aria-label="GitQuiet">
          <Mark size={26} color={INK} />
          <Wordmark size={24} color={INK} />
        </a>

        {/*
          A height, not a floor under one, and the tour depends on it both ways. A card
          that grows by three hundred pixels on the press of Next is a card the reader
          has to find their place in again — and a card free to grow grew past the
          window, because a screen is eight hundred pixels tall and asked for all of
          them. Told how tall it is, it gives the picture what the words leave.
        */}
        <div className="flex h-[min(700px,calc(100dvh-170px))] w-full flex-col rounded-2xl bg-white/70 p-6 shadow-[0_1px_2px_rgba(27,23,37,0.05),0_24px_60px_-24px_rgba(27,23,37,0.22)] backdrop-blur-[10px] sm:p-9">
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

              return (
                <Live
                  view={view}
                  eager
                  focus={{ x: 0, y: 0, width: view.width, height: ROOM[shot] ?? DEEP }}
                />
              )
            }}
            ending={
              already
                ? {
                    title: "It is already working.",
                    says: [
                      "Nothing left to set up. Open any pull request on github.com and you are looking at the screen you have just seen.",
                      "GitQuiet reads the page you are on and nothing else. No account, and no server of ours in the middle."
                    ],
                    act: (
                      <a className="tour-press" href={THEIR_PULLS}>
                        Open your pull requests
                      </a>
                    )
                  }
                : {
                    title: "Add it to Chrome.",
                    says: [
                      "It works on the pages you already use, so there is nothing to import and nobody to invite.",
                      "There is a Mac app as well, with the same screens in a window of their own."
                    ],
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

        <p className="text-[13px] text-muted">
          No account and no server. Your token stays on your machine.
        </p>
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
