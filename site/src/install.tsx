import "@fontsource-variable/inter"
import type { ReactNode } from "react"
import { mount } from "./mount"
import {
  Above,
  AddToChrome,
  Footer,
  HELD,
  Nav,
  Press,
  Quietly,
  SkipTo,
  SOURCE_AT,
  Source
} from "./Shell"
import { inSize, useAppStore, useRelease } from "./ways"
import "./index.css"

/**
 * Every way in, at `/install`, with the state each one is actually in.
 *
 * The landing page has one button because a reader on it is deciding whether they want
 * this at all. A reader here has decided, and is on a particular browser on a
 * particular machine, so this page answers the question they have: which file, how big,
 * and is it ready.
 *
 * Two of the rows are read live — see `ways.ts`. The Firefox row is the one this page
 * cannot ask about, and no longer needs to: Mozilla approved the first listing the day
 * 0.3.0 went out, and a public listing's address does not change between releases.
 */

/*
 * `releases/latest/download` and a fixed file name, because that is the only link to a
 * release asset that survives the next release. So this file is not edited to cut one,
 * and is not stale between them. The workflow attaches each image under the version as
 * well, for the downloads folder it lands in, and the sizes below are read off these
 * same two names.
 */
const SAFARI_DMG = "GitQuiet-safari.dmg"
const MAC_DMG = "GitQuiet-macos-arm64.dmg"
const download = (file: string) => `${SOURCE_AT}/releases/latest/download/${file}`

/* Without a locale, so Mozilla answers each reader in their own. */
const FIREFOX_AT = "https://addons.mozilla.org/firefox/addon/gitquiet/"

/** One way in: what it is, what it runs on, and how to get it. */
const Way = ({
  name,
  runs,
  children,
  after
}: {
  readonly name: string
  readonly runs: string
  readonly children: ReactNode
  readonly after: ReactNode
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

    <p className="m-0 text-[13px] leading-relaxed text-muted">{after}</p>
  </section>
)

/**
 * What a row says while the store it needs has nothing to give.
 *
 * A sentence rather than a greyed-out button: a control that cannot be pressed is a
 * reader pressing it twice and then wondering what they did wrong.
 *
 * It says where the app is not, rather than what the store is doing this minute. For
 * Safari that is all the page knows: a read that never landed and a review that has not
 * finished arrive here as the same nothing, and a page cannot report on Apple's day
 * from an answer it did not get.
 */
const Absent = ({ says }: { readonly says: string }) => (
  <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px] text-ink/70">
    <span className="eyebrow">Not yet</span>
    {says}
  </p>
)

const Install = () => {
  const release = useRelease()
  const appStore = useAppStore()
  const safari = inSize(release?.sizes[SAFARI_DMG])
  const mac = inSize(release?.sizes[MAC_DMG])

  /*
   * A row offers its download when the latest release holds the file, and says nothing
   * where it does not. 0.2.6 went out without the Mac app, because that one job failed
   * after the tag was written, and the fixed `latest/download` address answered 404 for
   * as long as it stayed the latest release.
   *
   * A read still in flight counts as held: `latest` is complete nearly every time, and
   * a button that arrives a second late is worse than one that was right.
   */
  const held = (size: string | undefined) => release === undefined || size !== undefined

  return (
    <>
      <SkipTo id="ways" says="Skip to the downloads" />

      <Above>
        <Nav>
          <Source />
        </Nav>

        <div className="pb-16 pt-10 sm:pt-16">
          <h1 className="m-0 max-w-3xl text-balance text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
            Install GitQuiet.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
            One codebase, four ways in. Nothing to configure after any of them.
          </p>

          {/*
            The version, once GitHub has answered, and nothing at all until then. A
            number written into this bundle would be right on the day it is deployed and
            quietly wrong after it.

            What it names is the release, which is not the same as what each store is
            serving: two of the four rows below are not serving anything yet, and a store
            serves what it last approved. So the sentence says release and stops.
          */}
          {release === undefined ? null : (
            <p className="live-in m-0 mt-5 text-[15px] text-ink/60">
              <Quietly at={`${SOURCE_AT}/releases/latest`}>
                <span className="tabular">Version {release.version}</span>
              </Quietly>{" "}
              is the latest release.
            </p>
          )}
        </div>
      </Above>

      <main className={HELD}>
        <div id="ways" className="grid gap-6 md:grid-cols-2">
          <Way
            name="Chrome"
            runs="Edge, Brave, Arc, Opera and any other Chromium browser use the same listing."
            after="Reviewed by Google, and it updates itself."
          >
            <AddToChrome />
          </Way>

          <Way
            name="Safari"
            runs="A Mac app that carries the extension, on Apple silicon."
            after="Open it once, then turn GitQuiet on in Safari, Settings, Extensions."
          >
            {appStore === undefined ? (
              <Absent says="Not on the Mac App Store. The first build is with Apple." />
            ) : (
              <Press at={appStore}>Get it from the App Store</Press>
            )}

            {/*
              The disk image stays on the row after the App Store answers. It is the same
              archive, signed and notarised, and it is the way in for anybody who does not
              want a store between them and a download.
            */}
            {held(safari) ? (
              <Quietly at={download(SAFARI_DMG)}>
                Disk image{safari === undefined ? "" : `, ${safari}`}
              </Quietly>
            ) : null}
          </Way>

          <Way
            name="Firefox"
            runs="The same extension, built for Firefox."
            after="Reviewed by Mozilla, and it updates itself."
          >
            <Press at={FIREFOX_AT}>Get it for Firefox</Press>
          </Way>

          <Way
            name="The Mac app"
            runs="A window of its own, no browser needed. Apple silicon."
            after="Signed and notarised by Apple. Sign in with GitHub the first time you open it."
          >
            {held(mac) ? (
              <Press at={download(MAC_DMG)}>Download{mac === undefined ? "" : `, ${mac}`}</Press>
            ) : (
              <Absent says="Not in the latest release." />
            )}
          </Way>
        </div>

        <section className="border-t border-rule py-16">
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Compared to</h2>
          <p className="m-0 mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
            GitQuiet is a working set on github.com, no extra login, filed by next
            action. Not an AI reviewer.
          </p>
          <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0 text-[16px]">
            <li>
              <Quietly at="/compare/prflow">PRFlow</Quietly>
              {" — "}in the tab, not a Chromium side panel.
            </li>
            <li>
              <Quietly at="/compare/github-pr-sidebar">GitHub PR Sidebar</Quietly>
              {" — "}one screen, not a side panel and a new tab.
            </li>
            <li>
              <Quietly at="/compare/refined-github">Refined GitHub</Quietly>
              {" — "}a queue, not github.com polish.
            </li>
            <li>
              <Quietly at="/compare/octobox">Octobox</Quietly>
              {" — "}on github.com, not a hosted inbox.
            </li>
          </ul>
        </section>

        <section className="border-t border-rule py-16">
          <p className="m-0 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
            All four are the same code, under AGPL-3.0.{" "}
            <Quietly at="/privacy.html">Read the privacy policy</Quietly>, or{" "}
            <Quietly at="/welcome">take the tour first</Quietly>.
          </p>
        </section>
      </main>

      <div className={HELD}>
        <Footer />
      </div>
    </>
  )
}

mount("page", <Install />)
