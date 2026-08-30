import type { ReactNode } from "react"
import { INK, MUTED } from "@/ui/bed"
import { Mark, Wordmark } from "@/ui/Mark"
import { Bed } from "./Bed"
import { inShort, useStars } from "./stars"

/**
 * The parts every page of this site draws the same way.
 *
 * Written once because the pages share them. They carry the same nav, the same
 * footer and the same lit header, and a second copy of any of them is a pair that
 * drifts: the radius on one, the star chip on the other, and a reader moving between
 * them feels a site assembled rather than made.
 */

export const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

export const SOURCE_AT = "https://github.com/flazouh/gitquiet"

/** Where every way in is listed, with the state each one is in. */
export const INSTALL_AT = "/install"

/**
 * The corner every button on this site turns.
 *
 * One radius for the lot, rather than a pill for the small ones and a rectangle for the
 * big one: two roundings on one strip is the sort of difference a reader feels without
 * being able to name. Eight pixels against the twelve the screens are drawn in, so a
 * control reads as tighter than the thing it acts on.
 *
 * A caller cannot write `focus:${EDGE}`. Tailwind reads these files for whole class
 * names, and a variant glued to a constant is not one, so the rule would simply never
 * be generated. `SkipTo` writes its own out in full for that reason.
 */
const EDGE = "rounded-md"

/** The column every page is set in. */
export const HELD = "mx-auto max-w-[1180px] px-6"

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
 * A control in the nav that is not the one to press.
 *
 * No outline, and no plate under the pointer either. One filled button is what a nav
 * wants a reader to press, and anything drawn around the rest argues with that. The
 * darkening ink and the press are the whole of the feedback.
 *
 * Shared by the source and by the word beside it, so the two keep the same height as
 * each other and the same corner as the filled button they stand next to.
 */
const WORD = `items-center ${EDGE} px-3 py-2 text-[14px] font-semibold text-ink/70 transition-[transform,color] duration-[var(--duration-press)] ease-out hover:text-ink active:scale-[var(--scale-press)] sm:px-3.5 sm:py-2.5 sm:text-[15px]`

/**
 * The source button, which is the mark, the count, and nothing else.
 *
 * The word "GitHub" went: the cat says it, the count beside it says it again, and the
 * button sits a centimetre from a heading that names the site.
 */
export const Source = () => {
  const many = useStars()

  return (
    <a
      href={SOURCE_AT}
      aria-label={
        many === undefined
          ? "GitQuiet source on GitHub"
          : `GitQuiet source on GitHub, ${many} ${many === 1 ? "star" : "stars"}`
      }
      className={`inline-flex ${WORD} gap-1.5`}
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

/**
 * A word in the nav, next to the button rather than instead of it.
 *
 * The store button is the press this site wants, and a reader on Safari or on Firefox
 * needs the other route said out loud rather than found in a footer. So it is a word
 * and not a second button: two filled controls a centimetre apart is a reader choosing
 * between them instead of pressing one.
 *
 * Away below 640px, where the nav has the mark, the source and the store button in
 * about three hundred pixels. The hero says the same thing directly under its button,
 * so a phone loses the shortcut rather than the route.
 */
export const Aside = ({ at, children }: { readonly at: string; readonly children: ReactNode }) => (
  <a href={at} className={`hidden sm:inline-flex ${WORD}`}>
    {children}
  </a>
)

/** The filled button, wherever a page wants one press to be the obvious one. */
export const Press = ({
  at,
  big = false,
  children
}: {
  readonly at: string
  readonly big?: boolean
  readonly children: ReactNode
}) => (
  <a
    href={at}
    className={`inline-flex items-center justify-center whitespace-nowrap ${EDGE} bg-ink font-semibold text-paper transition-[transform,background-color] duration-[var(--duration-press)] ease-out hover:bg-ink/85 active:scale-[var(--scale-press)] ${
      big ? "px-7 py-3.5 text-[17px]" : "px-4 py-2 text-[14px] sm:px-5 sm:py-2.5 sm:text-[15px]"
    }`}
  >
    {children}
  </a>
)

export const AddToChrome = ({ big = false }: { readonly big?: boolean }) => (
  <Press at={STORE_AT} big={big}>
    Add to Chrome
  </Press>
)

/** A file the browser saves rather than an address it goes to. */
const SAVED = /\.(dmg|zip|pkg)$/

/*
 * The underlined link inside a paragraph, which is every link here that is not a
 * button. Four places wrote this by hand, and three of them had drifted off the
 * shared duration the buttons animate on.
 *
 * A link that leaves the site opens beside it, and a link to a file does not: the
 * download leaves the page where it was, so a second tab is one the reader has to
 * close after it has finished doing nothing.
 */
export const Quietly = ({ at, children }: { readonly at: string; readonly children: ReactNode }) => {
  const away = at.startsWith("http") && !SAVED.test(at)

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

/**
 * Past the nav, to the part of the page the reader came for.
 *
 * Here rather than on each page, because the nav it skips is here. Each page says
 * what it is skipping to, since that is the one part of it that differs.
 */
export const SkipTo = ({ id, says }: { readonly id: string; readonly says: string }) => (
  <a
    href={`#${id}`}
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
  >
    {says}
  </a>
)

/**
 * The lit top of a page: the mesh, faded out into the paper, with the column on it.
 *
 * One copy, because this is the part of the site that is hardest to write twice
 * correctly. `Bed` puts `position: relative` in its own inline style, so the position
 * here has to be inline as well to outrank it, and the mask has to be given to WebKit
 * under its own name. Both are the sort of line that gets pasted, edited on one page,
 * and left on the other.
 */
const FADE = "linear-gradient(to bottom, black 58%, transparent 100%)"

export const Above = ({ children }: { readonly children: ReactNode }) => (
  <header className="relative isolate overflow-hidden">
    <Bed
      alive
      rotation={14}
      scale={1.45}
      className="pointer-events-none absolute inset-0"
      style={{
        position: "absolute",
        zIndex: -10,
        maskImage: FADE,
        WebkitMaskImage: FADE
      }}
    />

    <div className={HELD}>{children}</div>
  </header>
)

/**
 * The strip at the top, where the caller says what the controls are.
 *
 * The nav owns the arrangement and nothing else, because the two pages want
 * different presses in it: the landing page wants the store, and the page that
 * lists every store does not want one of them singled out.
 */
export const Nav = ({ children }: { readonly children: ReactNode }) => (
  <nav className="flex items-center justify-between py-7">
    <a href="/" className="flex items-center gap-2.5" aria-label="GitQuiet">
      <Mark size={30} color={INK} />
      {/* On the narrowest phones the mark carries the name on its own, so the
          install button keeps the width it needs. */}
      <span className="hidden min-[360px]:inline">
        <Wordmark size={20} color={INK} />
      </span>
    </a>
    <div className="flex items-center gap-2">{children}</div>
  </nav>
)

export const Footer = () => (
  <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-rule py-10 text-[14px] text-muted">
    <div className="flex items-center gap-2.5">
      <Mark size={22} color={MUTED} />
      <span>gitquiet</span>
    </div>

    <div className="flex flex-wrap items-center gap-6">
      <a
        href={INSTALL_AT}
        className="text-muted transition-colors duration-[var(--duration-press)] ease-out hover:text-ink"
      >
        Every way to install
      </a>
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
)
