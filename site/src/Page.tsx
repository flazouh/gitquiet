import { useEffect } from "react"
import { Atmosphere } from "./Atmosphere"
import { PrPanel } from "./PrPanel"
import {
  AddToChrome,
  Aside,
  Footer,
  INSTALL_AT,
  Nav,
  Quietly,
  SkipTo,
  Source
} from "./Shell"

/**
 * Home: Luminar poster hero — full-viewport rounded card, nav inside,
 * copy left + composed PR panel right. Sober Wafer atmosphere. New prose.
 * No demo video, no recycled product PNGs, no old Shell demo chrome.
 */

const Elsewhere = () => (
  <p className="m-0 text-[15px] leading-relaxed text-white/70">
    Also on <Quietly at={INSTALL_AT}>Safari, Firefox, and Mac</Quietly>.
  </p>
)

export const Page = () => {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      scheme: html.style.colorScheme
    }
    html.style.background = "#0c0c0c"
    html.style.colorScheme = "dark"
    body.style.background = "#0c0c0c"
    return () => {
      html.style.background = prev.htmlBg
      html.style.colorScheme = prev.scheme
      body.style.background = prev.bodyBg
    }
  }, [])

  return (
    <div className="min-h-dvh bg-[#0c0c0c] text-[#f2f2ee] antialiased">
      <SkipTo id="product" says="Skip to the product" />

      {/* Luminar gutter + poster card */}
      <header className="p-2.5 sm:p-3">
        <div className="relative flex min-h-[calc(100svh-20px)] flex-col overflow-hidden rounded-[24px] sm:min-h-[calc(100svh-24px)] sm:rounded-[28px]">
          <Atmosphere />

          <div className="relative z-10">
            <Nav dark>
              <Source dark />
              <Aside at={INSTALL_AT} dark>
                Install
              </Aside>
              <AddToChrome light />
            </Nav>
          </div>

          <div
            id="product"
            className="relative z-10 mt-auto grid flex-1 items-center gap-10 px-5 pb-10 pt-8 sm:px-9 sm:pb-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 lg:gap-16"
          >
            <div>
              <h1 className="m-0 max-w-[18ch] text-balance text-[clamp(2.5rem,5.2vw,4.75rem)] font-medium leading-[1.02] tracking-tight text-white">
                A faster, quieter GitHub.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/90 sm:text-xl">
                Pull requests that need you, filed by next action—on the session you already have.
                Not an AI reviewer.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <AddToChrome big light />
                <Elsewhere />
              </div>
            </div>

            <div className="flex justify-center md:justify-end">
              <PrPanel />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 pb-4 pt-10">
        <p className="m-0 max-w-2xl text-[15px] leading-relaxed text-white/55">
          Looking for a{" "}
          <Quietly at="/github-pr-inbox">GitHub PR inbox</Quietly> or a{" "}
          <Quietly at="/github-review-queue">review queue</Quietly>? Same quiet client, in the tab.
        </p>
        <Footer dark />
      </div>
    </div>
  )
}
