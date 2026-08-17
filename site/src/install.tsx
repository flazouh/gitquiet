import "@fontsource-variable/inter"
import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { Bed } from "./Bed"
import { AddToChrome, Footer, HELD, Press, Quietly, SOURCE_AT, Source, Nav } from "./Shell"
import { inSize, type Release, useAppStore, useRelease } from "./ways"
import "./index.css"

/**
 * Every way in, at `/install`, with the state each one is actually in.
 *
 * The landing page has one button because a reader on it is deciding whether they
 * want this at all. A reader here has decided, and is on a particular browser on a
 * particular machine, so this page answers the question they have: which file, how
 * big, and is it ready.
 *
 * Two of the four rows are read live — see `ways.ts`. The Firefox row is the one
 * this page cannot ask about, so it says what is true and says who it is waiting
 * for rather than showing a link that answers 404.
 */

/*
 * `releases/latest/download` and a fixed file name, because that is the only link to
 * a release asset that survives the next release. So this file is not edited to cut
 * one, and is not stale between them. The workflow attaches each image under the
 * version as well, for the downloads folder it lands in, and the sizes below are read
 * off these same two names.
 */
const SAFARI_DMG = "GitQuiet-safari.dmg"
const MAC_DMG = "GitQuiet-macos-arm64.dmg"
const at = (file: string) => `${SOURCE_AT}/releases/latest/download/${file}`

/** One way in: what it is, what it runs on, and how to get it. */
const Way = ({
  name,
  runs,
  children,
  then
}: {
  readonly name: string
  readonly runs: string
  readonly children: ReactNode
  readonly then: ReactNode
}) => (
  <section className="quote-card gap-5">
    <div>
      <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{name}</h2>
      <p className="m-0 mt-2 text-[15px] leading-relaxed text-muted">{runs}</p>
    </div>

    {/*
      Pushed to the bottom of the card, so the presses in a row of cards sit on one
      line however long the sentence above each of them ran.
    */}
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3">{children}</div>

    <p className="m-0 text-[13px] leading-relaxed text-muted">{then}</p>
  </section>
)

/**
 * What a row says while the store it needs is not ready.
 *
 * A sentence naming who is holding it, rather than a greyed-out button: a control
 * that cannot be pressed is a reader pressing it twice and then wondering what they
 * did wrong.
 */
const Waiting = ({ on }: { readonly on: string }) => (
  <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px] text-ink/70">
    <span className="eyebrow">In review</span>
    {on}
  </p>
)

/*
 * The release is read once, by the page, and handed down. Two components asking for
 * it is two reads of the same address on every visit, and a rate limit is shared.
 */
const Ways = ({ release }: { readonly release: Release | undefined }) => {
  const appStore = useAppStore()
  const size = (file: string) => inSize(release?.sizes[file])

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Way
        name="Chrome"
        runs="Edge, Brave, Arc, Opera and any other Chromium browser use the same listing."
        then="Reviewed by Google, and it updates itself."
      >
        <AddToChrome />
      </Way>

      <Way
        name="Safari"
        runs="A Mac app that carries the extension, on Apple silicon."
        then="Open it once, then turn GitQuiet on in Safari, Settings, Extensions."
      >
        {appStore === undefined ? (
          <Waiting on="Apple is reviewing the first build." />
        ) : (
          <Press at={appStore}>Get it from the App Store</Press>
        )}

        {/*
          The disk image stays on the row after the App Store answers. It is the same
          archive, signed and notarised, and it is the way in for anybody who does not
          want a store between them and a download.
        */}
        <Quietly at={at(SAFARI_DMG)}>
          Disk image{size(SAFARI_DMG) === undefined ? "" : `, ${size(SAFARI_DMG)}`}
        </Quietly>
      </Way>

      <Way
        name="Firefox"
        runs="The same extension, built for Firefox."
        then="This page grows a button on the day the listing is public."
      >
        <Waiting on="Mozilla is reviewing the first listing." />
      </Way>

      <Way
        name="The Mac app"
        runs="A window of its own, no browser needed. Apple silicon."
        then="Signed and notarised by Apple. Sign in with GitHub the first time you open it."
      >
        <Press at={at(MAC_DMG)}>
          Download{size(MAC_DMG) === undefined ? "" : ` — ${size(MAC_DMG)}`}
        </Press>
      </Way>
    </div>
  )
}

const Install = () => {
  const release = useRelease()

  return (
    <>
      <header className="relative isolate overflow-hidden">
        <Bed
          alive
          rotation={14}
          scale={1.45}
          className="pointer-events-none absolute inset-0"
          style={{
            position: "absolute",
            zIndex: -10,
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)"
          }}
        />

        <div className={HELD}>
          <Nav>
            <Source />
          </Nav>

          <div className="pb-16 pt-10 sm:pt-16">
            <h1 className="m-0 max-w-3xl text-balance text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              Install GitQuiet.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
              One codebase, four ways in. No account, no server, and nothing to configure
              after any of them.
            </p>

            {/*
              The version, once GitHub has answered, and nothing at all until then. A
              number written into this bundle would be right on the day it is deployed
              and quietly wrong after it.
            */}
            {release === undefined ? null : (
              <p className="live-in m-0 mt-5 text-[15px] text-ink/60">
                <Quietly at={`${SOURCE_AT}/releases/latest`}>
                  <span className="tabular">Version {release.version}</span>
                </Quietly>{" "}
                is the current release of all four.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className={HELD}>
        <Ways release={release} />

        <section className="border-t border-rule py-16">
          <p className="m-0 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
            All four are the same code, under AGPL-3.0. None of them has a server: GitQuiet
            talks to github.com from your own browser and to nothing else.{" "}
            <Quietly at="/privacy.html">Read the privacy policy</Quietly>, or{" "}
            <Quietly at="/welcome">take the tour first</Quietly>.
          </p>
        </section>

        <Footer />
      </main>
    </>
  )
}

const page = document.getElementById("page")
if (page === null) throw new Error("#page is missing from install.html")

createRoot(page).render(
  <StrictMode>
    <Install />
  </StrictMode>
)
