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

const SAFARI_DMG = "GitQuiet-safari.dmg"
const MAC_DMG = "GitQuiet-macos-arm64.dmg"
const download = (file: string) => `${SOURCE_AT}/releases/latest/download/${file}`
const FIREFOX_AT = "https://addons.mozilla.org/firefox/addon/gitquiet/"

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
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3">{children}</div>
    <p className="m-0 text-[13px] leading-relaxed text-muted">{after}</p>
  </section>
)

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
            Get GitQuiet.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
            Four installs. Same quieter client. Nothing to configure after any of them.
          </p>

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
            runs="Edge, Brave, Arc, Opera, and any other Chromium browser share this listing."
            after="Reviewed by Google; it updates itself."
          >
            <AddToChrome />
          </Way>

          <Way
            name="Safari"
            runs="A Mac app that carries the extension, on Apple silicon."
            after="Open it once, then enable GitQuiet in Safari → Settings → Extensions."
          >
            {appStore === undefined ? (
              <Absent says="Not on the Mac App Store yet. The first build is with Apple." />
            ) : (
              <Press at={appStore}>Get it from the App Store</Press>
            )}
            {held(safari) ? (
              <Quietly at={download(SAFARI_DMG)}>
                Disk image{safari === undefined ? "" : `, ${safari}`}
              </Quietly>
            ) : null}
          </Way>

          <Way
            name="Firefox"
            runs="The same extension, built for Firefox."
            after="Reviewed by Mozilla; it updates itself."
          >
            <Press at={FIREFOX_AT}>Get it for Firefox</Press>
          </Way>

          <Way
            name="Mac app"
            runs="A window of its own—no browser required. Apple silicon."
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
            GitQuiet stays on github.com, uses your existing session, and files work by next
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
          <p className="m-0 mt-8 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
            For one list of pull requests that need you, see{" "}
            <Quietly at="/github-pr-inbox">a GitHub PR inbox, in the tab</Quietly>.
          </p>
          <p className="m-0 mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
            For a queue you drain—next review, not recency—see{" "}
            <Quietly at="/github-review-queue">a GitHub review queue, in the tab</Quietly>.
          </p>
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
