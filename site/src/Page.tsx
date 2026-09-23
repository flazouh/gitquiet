import { useEffect } from "react"
import { Atmosphere } from "./Atmosphere"
import { HeroCarousel } from "./HeroCarousel"
import { AddToChrome, Nav, SkipTo, Source } from "./Shell"

/**
 * Home: Luminar poster hero — full-viewport rounded card, nav inside,
 * copy left + larger flush-right screenshot carousel (controls under the
 * shot). Live Wafer Atmosphere. No demo video, no recycled store shots,
 * no old Shell demo chrome.
 */

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
              <AddToChrome light />
            </Nav>
          </div>

          <div
            id="product"
            className="relative z-10 mt-auto flex flex-1 flex-col gap-10 px-5 pb-10 pt-8 sm:px-9 sm:pb-14 md:block md:px-0 md:py-0 md:pl-9 md:pr-0"
          >
            <div className="md:flex md:min-h-[calc(100svh-20px-3rem)] md:max-w-[min(36%,26rem)] md:flex-col md:justify-center md:py-14 md:pr-6 lg:max-w-[28rem] lg:pr-10">
              <h1 className="m-0 max-w-[18ch] text-balance text-[clamp(2.5rem,5.2vw,4.75rem)] font-medium leading-[1.02] tracking-tight text-white">
                A faster, quieter GitHub.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/90 sm:text-xl">
                Pull requests that need you, filed by next action—on the session you already have.
                Not an AI reviewer.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <AddToChrome big light />
              </div>
            </div>

            {/* Larger flush-right shot; prev/next sit under the frame (left-aligned) */}
            <div className="w-full md:absolute md:right-0 md:top-1/2 md:w-[min(64%,48rem)] md:-translate-y-1/2 md:pl-6">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}
