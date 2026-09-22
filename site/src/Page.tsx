import { PAPER } from "@/ui/bed"
import { HERO_SHADOW } from "./brand"
import { Bed } from "./Bed"
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
  <p className="m-0 text-[15px] leading-relaxed text-white/55">
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
  <p className="m-0 text-[15px] leading-relaxed text-ink/70">
    A <Quietly at="/github-pr-inbox">GitHub PR inbox</Quietly> and a{" "}
    <Quietly at="/github-review-queue">review queue</Quietly>, in the tab. Not an AI
    reviewer.
  </p>
)

/**
 * The product view in the hero: a framed still of the pull-request screen.
 *
 * Not the old demo video. A screenshot is quieter, loads as a normal image, and
 * matches the charcoal bed without fighting it for attention.
 */
const ProductView = () => (
  <figure className="m-0">
    <img
      src="/shots/pull-request@2x.png"
      width={1280}
      height={800}
      alt="GitQuiet pull request view: unresolved threads and checks above the diff"
      decoding="async"
      fetchPriority="high"
      className="block w-full rounded-2xl bg-paper ring-1 ring-white/10"
      style={{ boxShadow: HERO_SHADOW }}
    />
  </figure>
)

/**
 * Home: Luminar-shaped hero card on the charcoal Wafer bed, copy left, PR shot right.
 *
 * One rounded full-viewport card with the living Bed mesh behind it. Light ink on
 * the dark field. Cool paper outside the card. Below the fold stays short — jobs
 * links and the shared footer.
 */
export const Page = () => (
  <div className="min-h-dvh antialiased" style={{ background: PAPER, color: "var(--color-ink, #15171B)" }}>
    <SkipTo id="product" says="Skip to the product" />

    <header className="p-2.5 sm:p-3">
      <div className="relative flex min-h-[calc(100svh-20px)] flex-col overflow-hidden rounded-[24px] sm:min-h-[calc(100svh-24px)] sm:rounded-[28px]">
        {/*
          Bed writes position inline, so this has to as well — same pattern as Above
          in Shell. Absolute fill keeps the mesh behind the flex column of content.
        */}
        <Bed
          alive
          rotation={14}
          scale={1.45}
          className="pointer-events-none absolute inset-0"
          style={{ position: "absolute", inset: 0 }}
        />

        <div className="relative z-10 flex min-h-[calc(100svh-20px)] flex-1 flex-col sm:min-h-[calc(100svh-24px)]">
          <div className="px-5 sm:px-9">
            <Nav dark>
              <Source dark />
              <Aside at={INSTALL_AT} dark>
                Downloads
              </Aside>
              <AddToChrome blue />
            </Nav>
          </div>

          <div
            id="product"
            className="mt-auto grid flex-1 items-center gap-10 px-5 pb-10 pt-4 sm:px-9 sm:pb-14 md:grid-cols-2 md:gap-12 lg:gap-16"
          >
            <div className="max-w-xl">
              <h1 className="m-0 text-balance text-[clamp(2.4rem,5.2vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                A faster, quieter GitHub.
              </h1>
              <p className="mt-5 max-w-md text-pretty text-[17px] leading-relaxed text-white/70 sm:text-lg">
                A quieter PR inbox — next action, not an AI reviewer.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 sm:mt-9">
                <AddToChrome big blue />
                <Elsewhere />
              </div>
            </div>

            <div className="min-w-0">
              <ProductView />
            </div>
          </div>
        </div>
      </div>
    </header>

    <div className={HELD}>
      <div className="pb-4 pt-10 sm:pt-12">
        <Jobs />
      </div>
      <Footer />
    </div>
  </div>
)
