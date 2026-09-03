import "@fontsource-variable/inter"
import { COMPARED } from "./compare/pages"
import { mount } from "./mount"
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
import "./index.css"

/**
 * The GitHub review queue job, at `/github-review-queue`.
 *
 * A page of its own rather than a fifth compare. Distinct from
 * `/github-pr-inbox`. Compare URLs stay the four in `compare/pages.ts`.
 * Pullwatch and Attention Set are named here, not given `/compare/` addresses.
 */

const PULLWATCH_AT =
  "https://chromewebstore.google.com/detail/pullwatch-pr-dashboard-fo/occmgmijpfljojcfifhhjoaeedmcbppl"

const ReviewQueue = () => (
  <>
    <SkipTo id="job" says="Skip to the job" />

    <Above>
      <Nav>
        <Source />
        <Aside at={INSTALL_AT}>Downloads</Aside>
        <AddToChrome />
      </Nav>

      <div className="pb-16 pt-10 sm:pt-16">
        <p className="eyebrow m-0">GitHub review queue</p>
        <h1 className="m-0 mt-4 max-w-3xl text-balance text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
          A GitHub review queue, in the tab
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
          A queue you drain. Next review, not recency. On the GitHub session you
          already have.
        </p>
        <div className="mt-10">
          <AddToChrome big />
        </div>
        <p className="m-0 mt-5 text-[15px] leading-relaxed text-ink/60">
          Or see <Quietly at={INSTALL_AT}>every way to install</Quietly>.
        </p>
      </div>
    </Above>

    <main className={HELD}>
      <section id="job" className="border-t border-rule py-16">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">The job</h2>
        <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
          People who look for a GitHub review queue want a queue they can drain.
          Next review, not the newest request. One list of pull requests that
          need you is a different job:{" "}
          <Quietly at="/github-pr-inbox">a GitHub PR inbox, in the tab</Quietly>.
        </p>
      </section>

      <section className="border-t border-rule py-16">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
          A filter is not a queue
        </h2>
        <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
          GitHub's review-requested list is a filter. Newest first. Still a list
          you scan. GitQuiet is a queue on github.com. Existing GitHub session.
          No extra login. It writes back through GitHub's own routes. Not an AI
          reviewer.
        </p>
      </section>

      <section className="border-t border-rule py-16">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
          Not a popup, and not a side panel
        </h2>
        <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
          <Quietly at={PULLWATCH_AT}>Pullwatch</Quietly> is a read-only toolbar
          popup on the same session: To Review, Authored, Merged. A popup is not
          the page.
        </p>
        <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
          <Quietly at="/compare/prflow">PRFlow</Quietly> and{" "}
          <Quietly at="/compare/github-pr-sidebar">GitHub PR Sidebar</Quietly> are
          Chromium side panels that ask for a PAT. They sit beside the tab.
          GitQuiet is the tab.
        </p>
        <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">
          Attention Set is a PAT whose-turn popup. A near-miss, not a URL of its
          own. Graphite is stacked pull requests. A different job.
        </p>
      </section>

      <section className="border-t border-rule py-16">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Also compared to</h2>
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {COMPARED.map((other) => (
            <li key={other.slug}>
              <Quietly at={`/compare/${other.slug}`}>GitQuiet vs {other.name}</Quietly>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-rule py-16">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
          A faster, quieter GitHub.
        </h2>
        <div className="mt-10">
          <AddToChrome big />
        </div>
        <p className="m-0 mt-5 text-[15px] leading-relaxed text-ink/60">
          <Quietly at={INSTALL_AT}>Every way to install</Quietly>
        </p>
      </section>
    </main>

    <div className={HELD}>
      <Footer />
    </div>
  </>
)

mount("page", <ReviewQueue />)
