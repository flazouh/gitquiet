import { VIEWS } from "../../shots/views"
import { Bed } from "./Bed"
import { Feature } from "./Feature"
import { Live } from "./Live"
import {
  Above,
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

/*
 * The ways in that are not the Chrome store, which is the button.
 *
 * One link to the page that holds all of them, rather than the two disk images
 * this sentence used to carry. That page knows which stores are ready and this
 * sentence cannot: it says the same thing on the day Apple approves and on the
 * day Mozilla does, and each of those days would otherwise be a deploy.
 *
 * Centred where it sits under the closing card, without being told to be: that
 * card centres its text already, and `text-align` is inherited.
 */
const Elsewhere = () => (
  <p className="m-0 text-[15px] leading-relaxed text-ink/60">
    Also for <Quietly at={INSTALL_AT}>Safari, Firefox and the Mac</Quietly>.
  </p>
)

const first = VIEWS[0]

export const Page = () => (
  <>
    <SkipTo id="screens" says="Skip to the screens" />

    <Above>
      <Nav>
        <Source />
        <Aside at={INSTALL_AT}>Downloads</Aside>
        <AddToChrome />
      </Nav>

      <div className="pb-44 pt-12 sm:pt-20">
        <h1 className="m-0 max-w-4xl text-balance text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
          A faster, quieter GitHub.
        </h1>

        <div className="mt-10">
          <AddToChrome big />
        </div>
      </div>
    </Above>

    <div className={HELD}>
      {first === undefined ? null : (
        <div className="relative z-10 -mt-32">
          <Live view={first} eager />
        </div>
      )}

      <section id="screens" className="border-t border-rule py-24">
        <div className="grid gap-20">
          {VIEWS.slice(1).map((view, at) => (
            <Feature key={view.name} view={view} at={at} />
          ))}
        </div>
      </section>

      <section className="border-t border-rule py-24">
        <div className="relative isolate overflow-hidden rounded-2xl">
          {/* The position has to come through the style, since Bed's own inline
              position would beat a class and leave the canvas nothing to fill. */}
          <Bed
            rotation={200}
            scale={1.3}
            className="-z-10"
            style={{ position: "absolute", inset: 0 }}
          />
          <div className="px-8 py-24 text-center sm:px-16">
            {/*
              The headline again, word for word, and nothing after it.
              A closing slogan is a second claim made by a product whose whole argument is
              that it is quiet, and the reader has just been shown twelve screens rather
              than told anything. Repeating the one line the page opens with closes it
              without asking for another sentence of trust.
            */}
            <h2 className="m-0 text-balance text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              A faster, quieter GitHub.
            </h2>

            <div className="mt-10 flex justify-center">
              <AddToChrome big />
            </div>

            <div className="mt-5">
              <Elsewhere />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  </>
)
