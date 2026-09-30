import type { ReactNode } from "react"
import { INK, MUTED, PAPER } from "@/ui/bed"
import { Mark, Wordmark } from "@/ui/Mark"
import { Bed } from "./Bed"
import { inShort, useStars } from "./stars"

/**
 * Marketing chrome rebuilt for Luminar proportions + sober Wafer colour.
 *
 * Button metrics from Luminar CtaButton / Hero:
 *   hero CTA  h-12 rounded-lg px-6 text-[15px]
 *   card radius 24–28px (poster)
 *   page gutter p-2.5 / p-3
 *   control radius --radius: 8px  → rounded-lg
 *
 * Mono CTAs (near-black / white). No cobalt, no pink Shell leftovers.
 */

export const STORE_AT =
  "https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe"

export const SOURCE_AT = "https://github.com/flazouh/gitquiet"


/** Control corner: 8px, matching Luminar `--radius`. */
const EDGE = "rounded-lg"

/** Inner column for simple pages (jobs, compare, welcome). */
export const HELD = "mx-auto w-full max-w-6xl px-6"

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

const WORD =
  `items-center ${EDGE} px-3 py-2 text-[14px] font-medium transition-colors duration-[var(--duration-press)] ease-out sm:px-3.5 sm:text-[15px]`

export const Source = ({ dark = false }: { readonly dark?: boolean }) => {
  const many = useStars()
  const word = dark
    ? `${WORD} text-white/60 hover:text-white`
    : `${WORD} text-ink/65 hover:text-ink`

  return (
    <a
      href={SOURCE_AT}
      aria-label={
        many === undefined
          ? "GitQuiet source on GitHub"
          : `GitQuiet source on GitHub, ${many} ${many === 1 ? "star" : "stars"}`
      }
      className={`inline-flex ${word} gap-1.5`}
    >
      <Octocat size={16} />
      {many === undefined ? null : (
        <span className="live-in flex items-center gap-1 tabular">
          <Star size={13} />
          {inShort(many)}
        </span>
      )}
    </a>
  )
}

export const Aside = ({
  at,
  children,
  dark = false
}: {
  readonly at: string
  readonly children: ReactNode
  readonly dark?: boolean
}) => {
  const word = dark
    ? `${WORD} text-white/60 hover:text-white`
    : `${WORD} text-ink/65 hover:text-ink`
  return (
    <a href={at} className={`hidden sm:inline-flex ${word}`}>
      {children}
    </a>
  )
}

/** Mono filled press — near-black on light, white on dark. Luminar hero metrics when `big`. */
export const Press = ({
  at,
  big = false,
  light = false,
  children
}: {
  readonly at: string
  readonly big?: boolean
  readonly light?: boolean
  readonly children: ReactNode
}) => (
  <a
    href={at}
    className={`inline-flex items-center justify-center whitespace-nowrap ${EDGE} font-medium transition-[transform,background-color] duration-[var(--duration-press)] ease-out active:scale-[var(--scale-press)] ${
      light
        ? "bg-white text-[#0c0c0c] hover:bg-white/90"
        : "bg-[#141416] text-[#f2f2ee] hover:bg-[#141416]/90"
    } ${big ? "h-12 px-6 text-[15px]" : "h-8 px-4 text-[13px] sm:h-9 sm:px-5 sm:text-[14px]"}`}
  >
    {children}
  </a>
)

/** Primary store CTA — new wording; same Chrome Web Store URL. */
export const AddToChrome = ({
  big = false,
  light = false
}: {
  readonly big?: boolean
  readonly light?: boolean
}) => (
  <Press at={STORE_AT} big={big} light={light}>
    Install for Chrome
  </Press>
)

const SAVED = /\.(dmg|zip|pkg)$/

export const Quietly = ({ at, children }: { readonly at: string; readonly children: ReactNode }) => {
  const away = at.startsWith("http") && !SAVED.test(at)

  return (
    <a
      className="underline decoration-current/30 underline-offset-2 transition-opacity duration-[var(--duration-press)] ease-out hover:decoration-current/70"
      href={at}
      target={away ? "_blank" : undefined}
      rel={away ? "noreferrer" : undefined}
    >
      {children}
    </a>
  )
}

export const SkipTo = ({ id, says }: { readonly id: string; readonly says: string }) => (
  <a
    href={`#${id}`}
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
  >
    {says}
  </a>
)

const FADE = "linear-gradient(to bottom, black 58%, transparent 100%)"

/** Lit header band for job / compare — sober bed, not pink. */
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

export const Nav = ({
  children,
  dark = false
}: {
  readonly children: ReactNode
  readonly dark?: boolean
}) => {
  const mark = dark ? PAPER : INK
  return (
    <nav
      className={`flex items-center justify-between ${
        dark ? "px-5 pt-5 text-white/85 sm:px-9 sm:pt-6" : "py-7"
      }`}
    >
      <a href="/" className="flex items-center gap-2.5" aria-label="GitQuiet">
        <Mark size={dark ? 24 : 28} color={mark} />
        <span className={`hidden min-[360px]:inline ${dark ? "" : ""}`}>
          <Wordmark size={dark ? 18 : 20} color={mark} />
        </span>
      </a>
      <div className={`flex items-center ${dark ? "gap-5 sm:gap-7" : "gap-2"}`}>{children}</div>
    </nav>
  )
}

export const Footer = ({ dark = false }: { readonly dark?: boolean }) => (
  <footer
    className={`flex flex-wrap items-center justify-between gap-6 py-10 text-[14px] ${
      dark ? "text-white/40" : "border-t border-rule text-muted"
    }`}
  >
    <div className="flex items-center gap-2.5">
      <Mark size={22} color={dark ? "rgba(242,242,238,0.4)" : MUTED} />
      <span>gitquiet</span>
    </div>

    <div className="flex flex-wrap items-center gap-6">
      <a
        href={SOURCE_AT}
        className={`inline-flex items-center gap-2 transition-colors duration-[var(--duration-press)] ease-out ${
          dark ? "text-white/40 hover:text-white" : "text-muted hover:text-ink"
        }`}
      >
        <Octocat size={15} />
        Source · AGPL-3.0
      </a>
      <p className="m-0">Not affiliated with GitHub.</p>
    </div>
  </footer>
)
