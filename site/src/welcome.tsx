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
import { Footer, HELD, Nav, Source, STORE_AT } from "./Shell"
import "./index.css"
import "@/ui/onboarding.css"

const LIGHT = { [SETTINGS]: { theme: { appearance: "light", pack: "gitquiet" } } }
const THEIR_PULLS = "https://github.com/pulls"

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

const fromTheExtension = (): boolean =>
  new URLSearchParams(window.location.search).get("from") === "extension"

/**
 * `/welcome` — onboarding on the sober bed. Live product fixtures (not marketing PNGs).
 */
const Welcome = () => {
  const already = fromTheExtension()

  return (
    <div className="relative flex min-h-dvh flex-col" style={BED_COLOURS}>
      <Bed
        style={{ position: "fixed", inset: 0, zIndex: 0, background: BED_IN_CSS }}
        {...BED_BEHIND}
        alive
      />

      <div className={`relative z-1 ${HELD}`}>
        <Nav>
          <Source />
        </Nav>
      </div>

      <main className="relative z-1 flex flex-1 items-center justify-center px-6 pb-14">
        <div className="flex h-[min(620px,calc(100dvh-260px))] w-full max-w-[1040px] flex-col overflow-hidden rounded-[14px] bg-white/80 shadow-[inset_0_0_0_1px_rgba(20,20,22,0.06),0_1px_2px_rgba(20,20,22,0.05),0_24px_60px_-26px_rgba(20,20,22,0.24)] backdrop-blur-[12px]">
          <Tour
            show={(shot) => <Screen shot={shot} />}
            ending={
              already
                ? {
                    title: "You are already in.",
                    says: ["Open any pull request on github.com. Nothing left to set up."],
                    act: (
                      <a className="tour-press" href={THEIR_PULLS}>
                        Open your pull requests
                      </a>
                    )
                  }
                : {
                    title: "Install for Chrome.",
                    says: [
                      "It works on the pages you already use. Firefox, Safari, and a Mac app too."
                    ],
                    act: (
                      <a className="tour-press" href={STORE_AT}>
                        Install for Chrome
                      </a>
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
