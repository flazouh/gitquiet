import {
  AddToChrome,
  Aside,
  Footer,
  GlassFrame,
  HELD,
  INSTALL_AT,
  Nav,
  Poster,
  Quietly,
  SkipTo,
  Source,
  chromeTokens
} from "./chrome"

const { PAPER, INK } = chromeTokens

const Elsewhere = () => (
  <p className="m-0 text-[15px] leading-relaxed text-ink/55">
    Also for <Quietly at={INSTALL_AT}>Safari, Firefox and the Mac</Quietly>.
  </p>
)

/**
 * The only other sentence the home page says.
 * Job pages keep their own URLs; this names them so a crawler (and a reader) can leave.
 */
const Jobs = () => (
  <p className="m-0 text-[15px] leading-relaxed text-ink/70">
    A <Quietly at="/github-pr-inbox">GitHub PR inbox</Quietly> and a{" "}
    <Quietly at="/github-review-queue">review queue</Quietly>, in the tab. Not an AI
    reviewer.
  </p>
)

/** Product still: PR view in dark glass — not old Shell/demo chrome. */
const ProductView = () => (
  <figure className="m-0">
    <GlassFrame>
      <img
        src="/shots/pull-request@2x.png"
        width={1280}
        height={800}
        alt="GitQuiet pull request view"
        decoding="async"
        fetchPriority="high"
        className="block h-auto w-full"
      />
    </GlassFrame>
  </figure>
)

/**
 * Home: Luminar-shaped poster hero on sober Wafer atmosphere.
 * Copy left, PR shot right. No demo video. No pink bed.
 */
export const Page = () => (
  <div className="min-h-dvh antialiased" style={{ background: PAPER, color: INK }}>
    <SkipTo id="product" says="Skip to the product" />

    <Poster>
      <div className="px-5 sm:px-9">
        <Nav>
          <Source />
          <Aside at={INSTALL_AT}>Downloads</Aside>
          <AddToChrome />
        </Nav>
      </div>

      <div
        id="product"
        className="mt-auto grid flex-1 items-center gap-10 px-5 pb-10 pt-4 sm:px-9 sm:pb-14 md:grid-cols-2 md:gap-12 lg:gap-16"
      >
        <div className="max-w-xl">
          <h1 className="m-0 text-balance text-[clamp(2.4rem,5.2vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
            A faster, quieter GitHub.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-[17px] leading-relaxed text-ink/65 sm:text-lg">
            Every pull request you are in, one screen, sorted by next action. Not an AI
            reviewer.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 sm:mt-9">
            <AddToChrome big />
            <Elsewhere />
          </div>
        </div>

        <div className="min-w-0">
          <ProductView />
        </div>
      </div>
    </Poster>

    <div className={HELD}>
      <div className="pb-4 pt-10 sm:pt-12">
        <Jobs />
      </div>
      <Footer />
    </div>
  </div>
)
