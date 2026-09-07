import { useEffect } from "react"
import { Demo } from "./Demo"
import {
  AddToChrome,
  Aside,
  Footer,
  HELD,
  INSTALL_AT,
  Nav,
  Quietly,
  SkipTo,
  Source
} from "./Shell"

const Elsewhere = () => (
  <p className="m-0 text-[15px] leading-relaxed text-white/45">
    Also for <Quietly at={INSTALL_AT}>Safari, Firefox and the Mac</Quietly>.
  </p>
)

/**
 * Home: one line, one press, one demo.
 *
 * The feature grid and the bed mesh are gone. The clip already carries the
 * product and the pastel, so the page stays dark and quiet around it.
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
    html.style.background = "#0c0b10"
    html.style.colorScheme = "dark"
    body.style.background = "#0c0b10"
    return () => {
      html.style.background = prev.htmlBg
      html.style.colorScheme = prev.scheme
      body.style.background = prev.bodyBg
    }
  }, [])

  return (
  <div className="min-h-dvh bg-[#0c0b10] text-[#f4f2ef]">
    <SkipTo id="demo" says="Skip to the demo" />

    <div className={HELD}>
      <Nav dark>
        <Source dark />
        <Aside at={INSTALL_AT} dark>
          Downloads
        </Aside>
        <AddToChrome light />
      </Nav>

      <div className="pb-10 pt-10 sm:pb-14 sm:pt-16">
        <h1 className="m-0 max-w-4xl text-balance text-[clamp(2.4rem,6.5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
          A faster, quieter GitHub.
        </h1>

        <div className="mt-8 sm:mt-10">
          <AddToChrome big light />
        </div>
      </div>

      <section id="demo" className="pb-16 sm:pb-24">
        <Demo />
      </section>

      <section className="border-t border-white/10 py-16 text-center sm:py-20">
        <h2 className="m-0 text-balance text-[clamp(1.6rem,4vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
          A faster, quieter GitHub.
        </h2>
        <div className="mt-8 flex justify-center">
          <AddToChrome big light />
        </div>
        <div className="mt-5">
          <Elsewhere />
        </div>
      </section>

      <Footer dark />
    </div>
  </div>
  )
}
