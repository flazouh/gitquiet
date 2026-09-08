import { useEffect } from "react"
import { Bed } from "./Bed"
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
  <p className="m-0 text-[15px] leading-relaxed text-ink/60">
    Also for <Quietly at={INSTALL_AT}>Safari, Firefox and the Mac</Quietly>.
  </p>
)

/**
 * The only other sentence the home page says.
 *
 * The commercial heads live on their own URLs. This names them so a crawler
 * (and a reader) can leave, without turning home into a second job page.
 */
const Jobs = () => (
  <p className="m-0 mt-6 text-[15px] leading-relaxed text-ink/70">
    A <Quietly at="/github-pr-inbox">GitHub PR inbox</Quietly> and a{" "}
    <Quietly at="/github-review-queue">review queue</Quietly>, in the tab. Not an AI reviewer.
  </p>
)

/**
 * Home: one line, one press, one demo, then the bed card.
 *
 * No feature grid. No rules. The clip already carries the product; the bed
 * is only the closing card, the same one the page used to close on.
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

        <section className="pb-16 sm:pb-24">
          <div className="relative isolate overflow-hidden rounded-2xl">
            {/* Bed writes position inline, so this has to as well. */}
            <Bed
              rotation={200}
              scale={1.3}
              className="-z-10"
              style={{ position: "absolute", inset: 0 }}
            />
            <div className="px-8 py-20 text-center text-ink sm:px-16 sm:py-24">
              <h2 className="m-0 text-balance text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
                A faster, quieter GitHub.
              </h2>

              <div className="mt-10 flex justify-center">
                <AddToChrome big />
              </div>

              <div className="mt-5">
                <Elsewhere />
              </div>

              <Jobs />
            </div>
          </div>
        </section>

        <Footer dark />
      </div>
    </div>
  )
}
