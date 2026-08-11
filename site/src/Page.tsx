import type { CSSProperties } from "react"
import { VIEWS } from "../../shots/views"
import { Bed } from "./Bed"
import { INK, MUTED } from "./brand"
import { Feature } from "./Feature"
import { Live } from "./Live"
import { Mark, Wordmark } from "./Mark"
import { PAINS } from "./pains"

const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

const Install = ({ big = false }: { readonly big?: boolean }) => (
  <a
    href={STORE_AT}
    className={`inline-flex items-center justify-center rounded-full bg-ink font-semibold text-paper transition-[transform,background-color] duration-[var(--duration-press)] ease-out hover:bg-ink/85 active:scale-[var(--scale-press)] ${
      big ? "px-7 py-3.5 text-[17px]" : "px-5 py-2.5 text-[15px]"
    }`}
  >
    Add to Chrome
  </a>
)

const Says = ({ over, title }: { readonly over: string; readonly title: string }) => (
  <header className="mb-12 max-w-2xl">
    <p className="eyebrow mb-4">{over}</p>
    <h2 className="m-0 text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
      {title}
    </h2>
  </header>
)

const COURTS = [
  { court: "Your Move", means: "You can act on it now." },
  { court: "Waiting", means: "Someone else has to act." },
  { court: "Running", means: "A machine is still working. Nothing to do but wait." },

  { court: "Settled", means: "Finished. Nothing left to do." }
]

const first = VIEWS[0]

const HELD = "mx-auto max-w-[1180px] px-6"

const stagger = (at: number): CSSProperties => ({ "--stagger": `${at * 60}ms` }) as CSSProperties

export const Page = () => (
  <>
    <a
      href="#screens"

      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
    >
      Skip to the screens
    </a>

    <header className="relative isolate overflow-hidden">
      <Bed
        alive
        rotation={14}
        scale={1.45}
        className="pointer-events-none absolute inset-0"
        style={{
          position: "absolute",
          zIndex: -10,

          maskImage: "linear-gradient(to bottom, black 58%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 58%, transparent 100%)"
        }}
      />

      <div className={HELD}>
        <nav className="flex items-center justify-between py-7">
          <div className="flex items-center gap-2.5">
            <Mark size={30} color={INK} />
            <Wordmark size={20} color={INK} />
          </div>
          <Install />
        </nav>

        <div className="pb-44 pt-12 sm:pt-20">
          <h1 className="m-0 max-w-4xl text-balance text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
            A faster, quieter GitHub.
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-[clamp(1.05rem,2.2vw,1.3rem)] leading-relaxed text-ink/70">
            GitQuiet is a Chrome extension for GitHub pull request review. It redraws thirteen
            pages on github.com itself, from a pull request to a failing Actions run. Your work
            is grouped by who has to act next: you, someone else, a machine, or nobody.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Install big />
            <span className="text-[15px] text-ink/60">Chrome and Edge. No account, no server.</span>
          </div>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink/60">
            Your code and reviews stay in your browser. Your teammates see your reviews and
            comments exactly as before, whether they installed it or not.{" "}
            <a
              className="underline decoration-ink/25 underline-offset-2 transition-colors hover:decoration-ink/60"
              href="/privacy.html"
            >
              Read the privacy policy
            </a>
            .
          </p>
        </div>
      </div>
    </header>

    <div className={HELD}>
      {first === undefined ? null : (
        <div className="relative z-10 -mt-32">
          <Live view={first} eager />
        </div>
      )}

      <section className="border-t border-rule py-24">
        <Says over="The idea" title="Is it my turn?" />
        <p className="-mt-4 mb-12 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          A review thread waiting on your reply. A failing check. A comment from a bot. A
          file that changed since you read it. A branch that needs the latest main. GitHub
          shows those in five different places, and not one of them tells you whose move it
          is. Here they are one list, in four groups.
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
          <a
            className="underline decoration-ink/25 underline-offset-2 transition-colors hover:decoration-ink/60"
            href="https://github.com/refined-github/refined-github"
            target="_blank"
            rel="noreferrer"
          >
            Refined GitHub
          </a>{" "}
          fixes hundreds of small annoyances on GitHub&rsquo;s own pages, and it is good at
          that: the Chrome store counted 100,000 users in August 2026. The two extensions
          differ in where they start.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
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
              <tr className="border-t border-rule">
                <th scope="row" className="py-5 pr-6 align-top text-[15px] font-medium">
                  The approach
                </th>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed text-muted">
                  Improves the pages GitHub drew, one annoyance at a time.
                </td>
                <td className="py-5 align-top text-[15px] leading-relaxed text-muted">
                  Redraws thirteen pages on github.com itself.
                </td>
              </tr>
              <tr className="border-t border-rule">
                <th scope="row" className="py-5 pr-6 align-top text-[15px] font-medium">
                  A pull request
                </th>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed text-muted">
                  Conversation and Files changed stay separate tabs.
                </td>
                <td className="py-5 align-top text-[15px] leading-relaxed text-muted">
                  One screen. No tabs.
                </td>
              </tr>

              <tr className="border-t border-rule">
                <th scope="row" className="py-5 pr-6 align-top text-[15px] font-medium">
                  A comment on code that moved
                </th>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed text-muted">
                  <a
                    className="underline decoration-ink/25 underline-offset-2 transition-colors hover:decoration-ink/60"
                    href="https://github.com/refined-github/refined-github/issues/7255"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Closed as not planned
                  </a>
                  , under the label &ldquo;impossible&rdquo;.
                </td>
                <td className="py-5 align-top text-[15px] leading-relaxed text-muted">
                  Stays visible, on the version of the code you wrote it about.
                </td>
              </tr>
              <tr className="border-t border-rule">
                <th scope="row" className="py-5 pr-6 align-top text-[15px] font-medium">
                  Your work across repositories
                </th>
                <td className="py-5 pr-6 align-top text-[15px] leading-relaxed text-muted">
                  GitHub&rsquo;s own lists, improved.
                </td>
                <td className="py-5 align-top text-[15px] leading-relaxed text-muted">
                  One list, grouped by who has to act next.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-10 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted">
          The third row is the tracker&rsquo;s own verdict, and it is honest: keeping a
          comment on code that moved would mean fetching every comment in the pull
          request&rsquo;s history, which a tool that improves the page GitHub drew cannot
          reasonably do. GitQuiet draws that page itself, so the comment stays.
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
          <Bed rotation={200} scale={1.3} className="absolute inset-0 -z-10" />
          <div className="px-8 py-20 text-center sm:px-16">
            <h2 className="m-0 text-balance text-[clamp(1.75rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              Nothing changes for anybody else.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink/70">
              Every review, comment and merge goes through GitHub, so a colleague who has never
              installed GitQuiet sees your work exactly as usual. There is no account and no
              server. GitQuiet uses the GitHub session you already have, and your code stays in
              your browser.
            </p>
            <div className="mt-9 flex justify-center">
              <Install big />
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-rule py-10 text-[14px] text-muted">
        <div className="flex items-center gap-2.5">
          <Mark size={22} color={MUTED} />
          <span>gitquiet</span>
        </div>

        <p className="m-0">Not affiliated with GitHub.</p>
      </footer>
    </div>
  </>
)
