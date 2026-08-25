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

/*
 * What the closing card promises, in the three the reader is actually weighing.
 *
 * Each line is the privacy policy's own claim, shortened: no account and no server,
 * the GitHub session already in the browser, the review content read where it is and
 * kept there. A fourth column would say something the policy does not.
 */
const SAME: readonly { readonly holds: string; readonly says: string }[] = [
  {
    holds: "Your sign-in",
    says: "The GitHub session you already have. There is no GitQuiet account to make."
  },
  {
    holds: "Your history",
    says: "Reviews, comments and merges go through GitHub and stay there."
  },
  {
    holds: "Your code",
    says: "Read on your own machine and kept there. There is no GitQuiet server."
  }
]

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

        {/*
          Twelve words, and they say where you are rather than what is modified.
          The subhead this replaced ran to forty-four: it named the category, counted
          the pages and described the mechanism before saying what a reader gets, at
          three times the length of every page it was measured against. See `COPY.md`.
        */}
        <p className="mt-7 max-w-xl text-pretty text-[clamp(1.05rem,2.2vw,1.3rem)] leading-relaxed text-ink/70">
          GitHub is where your work lives. GitQuiet is where you do it.
        </p>

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
            <h2 className="m-0 text-balance text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              Your team sees the same GitHub.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
              A colleague who has never heard of GitQuiet reads your work where they have
              always read it.
            </p>

            <dl className="mx-auto mt-16 grid max-w-3xl gap-8 text-left sm:grid-cols-3">
              {SAME.map((one) => (
                <div key={one.holds} className="border-t border-ink/25 pt-5">
                  <dt className="text-[17px] font-semibold tracking-[-0.02em]">{one.holds}</dt>
                  <dd className="m-0 mt-3 text-[15px] leading-relaxed text-ink/70">{one.says}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-16 flex justify-center">
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
