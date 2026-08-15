import type { CSSProperties, ReactNode } from "react"
import { VIEWS } from "../../shots/views"
import { Bed } from "./Bed"
import { INK, MUTED } from "./brand"
import { Feature } from "./Feature"
import { Live } from "./Live"
import { Mark, Wordmark } from "./Mark"
import { PAINS } from "./pains"
import { inShort, useStars } from "./stars"

const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

const SOURCE_AT = "https://github.com/flazouh/gitquiet"

/*
 * The two ways in that are not the Chrome store, which is the button.
 *
 * `releases/latest/download` and a fixed file name, because that is the only link
 * to a release asset that survives the next release. So this file is not edited to
 * cut one, and is not stale between them. The release workflow attaches each disk
 * image under the version as well, for the downloads folder it lands in.
 *
 * Firefox is absent rather than pending. addons.mozilla.org answers 404 for a
 * listing it has not approved yet, and a dead link reads as a dead product, so it
 * goes in here on the day the listing is public.
 */
const SAFARI_AT = `${SOURCE_AT}/releases/latest/download/GitQuiet-safari.dmg`
const MAC_AT = `${SOURCE_AT}/releases/latest/download/GitQuiet-macos-arm64.dmg`

const Octocat = ({ size = 17 }: { readonly size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.15 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
)

const Star = ({ size = 14 }: { readonly size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
)

/**
 * The corner every button on this page turns.
 *
 * One radius for the lot, rather than a pill for the small ones and a rectangle for the
 * big one: two roundings on one strip is the sort of difference a reader feels without
 * being able to name. Eight pixels against the twelve the screens are drawn in, so a
 * control reads as tighter than the thing it acts on.
 */
const EDGE = "rounded-md"

/*
 * The skip link below writes `focus:rounded-md` out in full rather than reaching for the
 * constant. Tailwind reads this file for whole class names, and a variant glued to a
 * constant is not one, so the rule would simply never be generated.
 */

/**
 * The source button, which is the mark, the count, and nothing else.
 *
 * The word "GitHub" went: the cat says it, the count beside it says it again, and the
 * button sits a centimetre from a heading that names the site. A rule between the two
 * halves went with it, since a border inside a bordered button is a box in a box.
 */
const Source = () => {
  const many = useStars()

  return (
    <a
      href={SOURCE_AT}
      aria-label={
        many === undefined
          ? "GitQuiet source on GitHub"
          : `GitQuiet source on GitHub, ${many} ${many === 1 ? "star" : "stars"}`
      }
      className={`inline-flex items-center gap-1.5 ${EDGE} border border-ink/15 px-3 py-2 text-[14px] font-semibold text-ink/70 transition-[transform,color,border-color] duration-[var(--duration-press)] ease-out hover:border-ink/35 hover:text-ink active:scale-[var(--scale-press)] sm:px-3.5 sm:py-2.5 sm:text-[15px]`}
    >
      <Octocat size={16} />
      {/*
       * The count, once it is known, and nothing at all until then.
       *
       * A nought while the read runs says the repository has no stars, which is a worse
       * thing to say than nothing. The button holds none of the layout either way: the
       * install button is to its right and keeps the corner.
       */}
      {many === undefined ? null : (
        <span className="live-in flex items-center gap-1 tabular">
          <Star size={13} />
          {inShort(many)}
        </span>
      )}
    </a>
  )
}

const Install = ({ big = false }: { readonly big?: boolean }) => (
  <a
    href={STORE_AT}
    className={`inline-flex items-center justify-center whitespace-nowrap ${EDGE} border border-ink bg-ink font-semibold text-paper transition-[transform,background-color,border-color] duration-[var(--duration-press)] ease-out hover:border-ink/85 hover:bg-ink/85 active:scale-[var(--scale-press)] ${
      big
        ? "px-7 py-3.5 text-[17px]"
        : "px-4 py-2 text-[14px] sm:px-5 sm:py-2.5 sm:text-[15px]"
    }`}
  >
    Add to Chrome
  </a>
)

/*
 * The underlined link inside a paragraph, which is every link here that is not a
 * button. Four places wrote this by hand, and three of them had drifted off the
 * shared duration the buttons animate on.
 *
 * A link that leaves the site opens beside it. That is the rule the four call
 * sites already followed, so it is read off the address rather than passed in.
 */
const Quietly = ({ at, children }: { readonly at: string; readonly children: ReactNode }) => {
  const away = at.startsWith("http")

  return (
    <a
      className="underline decoration-ink/25 underline-offset-2 transition-colors duration-[var(--duration-press)] ease-out hover:decoration-ink/60"
      href={at}
      target={away ? "_blank" : undefined}
      rel={away ? "noreferrer" : undefined}
    >
      {children}
    </a>
  )
}

/*
 * A sentence rather than a joined list, because the ways in are reached three
 * different ways and no separator makes that read as English. Firefox joins it
 * here, in prose, on the day the listing is public.
 *
 * Centred where it sits under the closing card, without being told to be: that
 * card centres its text already, and `text-align` is inherited.
 */
const Elsewhere = () => (
  <p className="m-0 text-[15px] leading-relaxed text-ink/60">
    Also for <Quietly at={SAFARI_AT}>Safari</Quietly>, or as a{" "}
    <Quietly at={MAC_AT}>macOS app</Quietly>.
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

const COURTS = [
  { court: "Your Move", means: "You can act on it now." },
  { court: "Waiting", means: "Someone else has to act." },
  { court: "Running", means: "A machine is still working. Nothing to do but wait." },

  { court: "Settled", means: "Finished. Nothing left to do." }
]

const AGAINST: readonly {
  readonly aspect: string
  readonly theirs: ReactNode
  readonly ours: string
}[] = [
  {
    aspect: "The approach",
    theirs: "Improves the pages GitHub drew, one annoyance at a time.",
    ours: "Redraws fourteen pages on github.com itself."
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
    ours: "One list, grouped by who has to act next."
  }
]

const first = VIEWS[0]

const HELD = "mx-auto max-w-[1180px] px-6"

const stagger = (at: number): CSSProperties => ({ "--stagger": `${at * 60}ms` }) as CSSProperties

export const Page = () => (
  <>
    <a
      href="#screens"

      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
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
            {/* On the narrowest phones the mark carries the name on its own, so the
                install button keeps the width it needs. */}
            <span className="hidden min-[360px]:inline">
              <Wordmark size={20} color={INK} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Source />
            <Install />
          </div>
        </nav>

        <div className="pb-44 pt-12 sm:pt-20">
          <h1 className="m-0 max-w-4xl text-balance text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
            A faster, quieter GitHub.
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-[clamp(1.05rem,2.2vw,1.3rem)] leading-relaxed text-ink/70">
            GitQuiet is a browser extension for GitHub pull request review. It redraws fourteen
            pages on github.com itself, from a pull request to a failing Actions run. Your work
            is grouped by who has to act next: you, someone else, a machine, or nobody.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Install big />
            <span className="text-[15px] text-ink/60">Chrome and Edge. No account, no server.</span>
          </div>

          <div className="mt-4">
            <Elsewhere />
          </div>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink/60">
            Your code and reviews stay in your browser. Your teammates see your reviews and
            comments exactly as before, whether they installed it or not.{" "}
            <Quietly at="/privacy.html">Read the privacy policy</Quietly>
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
          <Quietly at="https://github.com/refined-github/refined-github">Refined GitHub</Quietly>{" "}
          fixes hundreds of small annoyances on GitHub&rsquo;s own pages, and it is good at
          that: the Chrome store counted 100,000 users in August 2026. The two extensions
          differ in where they start.
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
              installed GitQuiet sees your work exactly as usual. There is no account and no
              server. GitQuiet uses the GitHub session you already have, and your code stays in
              your browser.
            </p>
            <div className="mt-9 flex justify-center">
              <Install big />
            </div>

            <div className="mt-5">
              <Elsewhere />
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-rule py-10 text-[14px] text-muted">
        <div className="flex items-center gap-2.5">
          <Mark size={22} color={MUTED} />
          <span>gitquiet</span>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <a
            href={SOURCE_AT}
            className="inline-flex items-center gap-2 text-muted transition-colors duration-[var(--duration-press)] ease-out hover:text-ink"
          >
            <Octocat size={15} />
            Source, under AGPL-3.0
          </a>
          <p className="m-0">Not affiliated with GitHub.</p>
        </div>
      </footer>
    </div>
  </>
)
