import type { CSSProperties, ReactNode } from "react"
import { COURTS as ALL_COURTS } from "@/domain/attention"
import { COURT_MEANS, COURT_NAME } from "@/ui/courts"
import { VIEWS } from "../../shots/views"
import { PRESS } from "../../video/src/measurements"
import { Bed } from "./Bed"
import { Feature } from "./Feature"
import { Live } from "./Live"
import { PAINS } from "./pains"
import {
  Above,
  AddToChrome,
  Footer,
  HELD,
  INSTALL_AT,
  Nav,
  Quietly,
  SkipTo,
  SOURCE_AT,
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
    Also for <Quietly at={INSTALL_AT}>Safari and the Mac</Quietly>.
  </p>
)

const Says = ({ over, title }: { readonly over: string; readonly title: string }) => (
  <header className="mb-12 max-w-2xl">
    <p className="eyebrow mb-4">{over}</p>
    <h2 className="m-0 text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
      {title}
    </h2>
  </header>
)

/*
 * The four the interface sorts everything into, read off the interface itself.
 *
 * The order, the names and the meanings are all the interface's own, from
 * `attention.ts` and `courts.ts`. Typed out again here, the page and the app came to
 * word the same four things differently.
 */
const COURTS = ALL_COURTS.map((court) => ({
  court: COURT_NAME[court],
  means: COURT_MEANS[court]
}))

/*
 * The one section that is allowed to talk about mechanism, because the question it
 * answers is a question about mechanism. Everywhere else on this page the words for
 * what GitQuiet does to GitHub's pages are out: they put it in the category of things
 * that patch somebody else's product, which is the category it is arguing its way out
 * of. Here a reader has asked how the two differ, and deserves the mechanical answer.
 */
const AGAINST: readonly {
  readonly aspect: string
  readonly theirs: ReactNode
  readonly ours: string
}[] = [
  {
    aspect: "What it is",
    theirs: "A set of fixes on GitHub’s pages.",
    ours: "Its own interface, on GitHub’s data."
  },
  {
    aspect: "A pull request",
    theirs: "Conversation and Files changed stay separate tabs.",
    ours: "One screen. No tabs."
  },
  {
    aspect: "A comment on code that moved",
    theirs: (
      <>
        <Quietly at="https://github.com/refined-github/refined-github/issues/7255">
          Closed as not planned
        </Quietly>
        , under the label &ldquo;impossible&rdquo;.
      </>
    ),
    ours: "Stays visible, on the version of the code you wrote it about."
  },
  {
    aspect: "Your work across repositories",
    theirs: "GitHub’s own lists, improved.",
    ours: `One list, and the first group is ${COURT_NAME["needs-you"].toLowerCase()}.`
  }
]

/*
 * The two presses the speed section quotes, read off the file the video reads.
 *
 * Imported rather than typed out, and from `video/` rather than a copy of its own:
 * these numbers are re-measured whenever the benchmark scripts are, and a page that
 * kept its own copy would go on claiming a figure nobody can reproduce. The doc block
 * beside them says how they were taken and what may not be said about them.
 *
 * Both rows always, in this order. Quoting the rested press alone is the claim the
 * repository's own script refutes.
 */
const RACES = [
  { when: "After a pause on the row", ...PRESS.warm },
  { when: "Pressed straight away", ...PRESS.cold }
] as const

const first = VIEWS[0]

const stagger = (at: number): CSSProperties => ({ "--stagger": `${at * 60}ms` }) as CSSProperties

export const Page = () => (
  <>
    <SkipTo id="screens" says="Skip to the screens" />

    <Above>
      <Nav>
        <Source />
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

        <div className="mt-10 flex flex-wrap items-center gap-5">
          <AddToChrome big />
          <span className="text-[15px] text-ink/60">Chrome and Edge. No account, no server.</span>
        </div>

        <div className="mt-4">
          <Elsewhere />
        </div>

        {/* The short half of the promise. The whole of it is the closing card, which is
            where a reader who has seen the screens is deciding whether to install. */}
        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink/60">
          Your code stays in your browser.{" "}
          <Quietly at="/privacy.html">Read the privacy policy</Quietly>
          .
        </p>
      </div>
    </Above>

    <div className={HELD}>
      {first === undefined ? null : (
        <div className="relative z-10 -mt-32">
          <Live view={first} eager />
        </div>
      )}

      <section className="border-t border-rule py-24">
        <Says over="The idea" title="You open it and you already know." />
        <p className="-mt-4 mb-12 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          A thread waiting on your reply, a failing check, a file that changed since you
          read it. GitHub keeps those in five different places. Here they are one list, and
          the first group is yours.
        </p>

        <dl className="m-0 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {COURTS.map((one) => (
            <div key={one.court} className="border-t border-ink/25 pt-5">
              <dt className="text-[19px] font-semibold tracking-[-0.02em]">{one.court}</dt>
              <dd className="m-0 mt-3 text-[15px] leading-relaxed text-muted">{one.means}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-rule py-24">
        <Says over="Measured on microsoft/vscode, August 2026" title="Already open when you press it." />
        <p className="-mt-4 mb-12 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          Rest on a row for a moment and GitQuiet has read the pull request ahead. Press it
          and you are reading in {PRESS.warm.ours}ms. GitHub takes two seconds.
        </p>

        <dl className="m-0 grid gap-9 sm:grid-cols-2">
          {RACES.map((race) => (
            <div key={race.when} className="border-t border-ink/25 pt-5">
              <dt className="text-[15px] font-medium">{race.when}</dt>
              <dd className="m-0 mt-4 flex items-baseline justify-between gap-6">
                <span className="eyebrow">GitHub</span>
                <span className="tabular text-[19px] text-muted">{race.github}ms</span>
              </dd>
              <dd className="m-0 mt-2 flex items-baseline justify-between gap-6 border-t border-rule pt-2">
                <span className="eyebrow">GitQuiet</span>
                <span className="tabular text-[19px] font-semibold">{race.ours}ms</span>
              </dd>
            </div>
          ))}
        </dl>

        {/*
          Both rows, and the second one is why this section can be quoted at all. The
          big number is the reading-ahead: without the pause it is half a second rather
          than thirty times, and a page that shows only the first row is a page whose
          own benchmark script takes it apart in the first comment thread.
        */}
        <p className="mt-10 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted">
          The gap is the reading ahead. Press without pausing and you save about half a
          second, not two. Medians of four pull requests, signed in, reproducible with{" "}
          <Quietly at={`${SOURCE_AT}/blob/main/scripts/benchmark-click-flow.js`}>
            the script that measured them
          </Quietly>
          .
        </p>
      </section>

      <section className="border-t border-rule py-24">
        <Says over="Public threads, read August 2026" title="Four complaints, and the answer to each." />
        <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2">
          {PAINS.map((pain, at) => (
            <li key={pain.at} className="quote-card" style={stagger(at)}>
              <blockquote className="m-0 text-pretty text-[17px] leading-snug">
                <a
                  href={pain.at}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink no-underline decoration-ink/30 underline-offset-4 hover:underline"
                >
                  “{pain.said}”
                </a>
              </blockquote>
              <p className="tabular eyebrow mt-3 text-[11px]">{pain.weight}</p>
              <p className="mt-auto pt-6 text-[15px] leading-relaxed text-muted">{pain.answer}</p>
            </li>
          ))}
        </ul>

      </section>

      <section className="border-t border-rule py-24">
        <Says over="The comparison" title="What about Refined GitHub?" />
        <p className="-mt-4 mb-12 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          <Quietly at="https://github.com/refined-github/refined-github">Refined GitHub</Quietly>{" "}
          fixes hundreds of small annoyances on GitHub&rsquo;s own pages, and it is good at
          that: the Chrome store counted 100,000 users in August 2026. It is a better
          GitHub. GitQuiet is somewhere else to work.
        </p>

        <table className="hidden w-full border-collapse text-left md:table">
          <thead>
            <tr className="border-t border-ink/25">
              <th className="w-[30%] py-5 pr-6 align-top" />
              <th className="w-[35%] py-5 pr-6 align-top text-[17px] font-semibold tracking-[-0.02em]">
                Refined GitHub
              </th>
              <th className="w-[35%] py-5 align-top text-[17px] font-semibold tracking-[-0.02em]">
                GitQuiet
              </th>
            </tr>
          </thead>
          <tbody>
            {AGAINST.map((row) => (
              <tr key={row.aspect} className="border-t border-rule">
                <th scope="row" className="py-5 pr-6 align-top text-[15px] font-medium">
                  {row.aspect}
                </th>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed text-muted">
                  {row.theirs}
                </td>
                <td className="py-5 align-top text-[15px] leading-relaxed text-muted">
                  {row.ours}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Three columns do not fit a phone, and a table nobody can read sideways is
            worse than the same four rows read downwards. */}
        <dl className="m-0 grid gap-9 md:hidden">
          {AGAINST.map((row) => (
            <div key={row.aspect} className="border-t border-rule pt-5">
              <dt className="text-[16px] font-semibold tracking-[-0.02em]">{row.aspect}</dt>
              <dd className="m-0 mt-4 text-[15px] leading-relaxed text-muted">
                <span className="eyebrow mb-1.5 block">Refined GitHub</span>
                {row.theirs}
              </dd>
              <dd className="m-0 mt-4 text-[15px] leading-relaxed text-muted">
                <span className="eyebrow mb-1.5 block">GitQuiet</span>
                {row.ours}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          The third row is the tracker&rsquo;s own verdict, and it is fair: keeping a comment
          on code that moved means fetching every comment in the pull request&rsquo;s
          history, which a set of fixes on somebody else&rsquo;s page cannot reasonably do.
          GitQuiet draws that screen itself, so the comment stays.
        </p>
      </section>

      <section id="screens" className="border-t border-rule py-24">
        <Says over="Every screen" title="These are the real screens, not pictures of them." />
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
          <div className="px-8 py-20 text-center sm:px-16">
            <h2 className="m-0 text-balance text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              Nothing changes for anybody else.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink/70">
              Every review, comment and merge goes through GitHub, so a colleague who has never
              installed GitQuiet sees your work exactly as usual. No account, no server.
              GitQuiet uses the GitHub session you already have.
            </p>
            <div className="mt-9 flex justify-center">
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
