import "@fontsource-variable/inter"
import { BED_BEHIND, BED_COLOURS, BED_IN_CSS } from "@/ui/bed"
import { SETTINGS } from "@/ui/keeping"
import type { Shot } from "@/ui/onboarding/beats"
import { Held } from "@/ui/onboarding/Held"
import { Tour } from "@/ui/onboarding/Tour"
import { mount } from "./mount"
import { Supplied } from "../../shots/Supplied"
import { viewNamed } from "../../shots/views"
import { Bed } from "./Bed"
import { Footer, HELD, INSTALL_AT, Nav, Press, Source, STORE_AT } from "./Shell"
import "./index.css"
import "@/ui/onboarding.css"

/** Light, whatever the reader's own machine prefers: the card it stands in is white. */
const LIGHT = { [SETTINGS]: { theme: { appearance: "light", pack: "gitquiet" } } }

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
 * under fixture data, which is what this site has always drawn — a picture of a screen is
 * a claim about it, and a screen is the thing itself.
 *
 * Three ways in: the extension opens it on install, the install page links to it for
 * anybody who wants the tour first, and the store listing points at it.
 *
 * In the site's own nav and footer, and that is the difference between this and a modal.
 * The extension opens this in a tab, so for most readers it is the first page of
 * gitquiet.com they ever see — and a tab that opened itself, with a card floating in it
 * and no way anywhere, reads as something that has taken over the browser. With the strip
 * every other page carries, it is a page: the name goes home, the source is where it is
 * on the other two, and the footer holds the privacy policy the last beat mentions.
 */
const Welcome = () => {
  const already = fromTheExtension()

  return (
    <div className="relative flex min-h-dvh flex-col" style={BED_COLOURS}>
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
        The same strip the landing page and the install page carry, and the control in it
        is read off where the reader came from. Somebody the extension just sent has
        nothing to install, so they get the source; anybody else gets every way in.
      */}
      <div className={`relative z-1 ${HELD}`}>
        <Nav>
          <Source />
          {already ? null : <Press at={INSTALL_AT}>Install</Press>}
        </Nav>
      </div>

      <main className="relative z-1 flex flex-1 items-center justify-center px-6 pb-14">
        {/*
          One sheet, no padding of its own, clipped to its own radius: the tour insets its
          picture and its words by different amounts, so the card cannot do it for them.

          A height, not a floor under one, and the tour depends on it both ways. A card
          that grows by three hundred pixels on the press of Next is a card the reader has
          to find their place in again — and a card free to grow grew past the window,
          because a screen is eight hundred pixels tall and asked for all of them. Told how
          tall it is, it gives the picture what the words leave.

          `100dvh` less the nav, the footer and this section's own padding, so the card is
          as tall as the room left rather than as tall as the window.
        */}
        <div className="flex h-[min(620px,calc(100dvh-260px))] w-full max-w-[1040px] flex-col overflow-hidden rounded-[14px] bg-white/80 shadow-[inset_0_0_0_1px_rgba(27,23,37,0.06),0_1px_2px_rgba(27,23,37,0.05),0_24px_60px_-26px_rgba(27,23,37,0.24)] backdrop-blur-[12px]">
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
                    says: ["It works on the pages you already use. Firefox, Safari and a Mac app as well."],
                    act: (
                      <div className="flex flex-wrap items-center gap-2">
                        <a className="tour-press" href={STORE_AT}>
                          Add to Chrome
                        </a>
                        <a className="tour-quietly" href={INSTALL_AT}>
                          Every way to install
                        </a>
                      </div>
                    )
                  }
            }
          />
        </div>
      </main>

      <div className={`relative z-1 ${HELD}`}>
        <Footer />
      </div>
    </div>
  )
}

mount("page", <Welcome />)
