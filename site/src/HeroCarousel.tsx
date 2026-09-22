import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { HERO_SHADOW, SCREEN_EDGE } from "./brand"

/**
 * Hero product carousel — five real screenshots in a Luminar-proportion frame.
 *
 * Auto-advances every 5s unless the user prefers reduced motion, or the frame
 * is hovered / focused. Prev / next + dots; arrow keys when focused.
 */

const SLIDES = [
  {
    src: "/hero/inbox.png",
    alt: "GitQuiet pull request inbox",
    label: "Inbox"
  },
  {
    src: "/hero/pull-request.png",
    alt: "Pull request with files and diff",
    label: "Pull request"
  },
  {
    src: "/hero/review.png",
    alt: "Review mode stepping through changes",
    label: "Review"
  },
  {
    src: "/hero/peek.png",
    alt: "Peek at a symbol in the file",
    label: "Peek"
  },
  {
    src: "/hero/repo.png",
    alt: "Repository home",
    label: "Repo"
  }
] as const

const INTERVAL_MS = 5000

const useCalm = (): boolean => {
  const [calm, setCalm] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const ask = window.matchMedia("(prefers-reduced-motion: reduce)")
    const heard = (event: MediaQueryListEvent) => setCalm(event.matches)
    ask.addEventListener("change", heard)
    return () => ask.removeEventListener("change", heard)
  }, [])

  return calm
}

const Chevron = ({ dir }: { readonly dir: "prev" | "next" }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="block">
    <path
      d={dir === "prev" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const HeroCarousel = () => {
  const calm = useCalm()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const count = SLIDES.length
  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  )
  const prev = useCallback(() => go(index - 1), [go, index])
  const next = useCallback(() => go(index + 1), [go, index])

  useEffect(() => {
    if (calm || paused) return
    const tick = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, INTERVAL_MS)
    return () => window.clearInterval(tick)
  }, [calm, paused, count])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      prev()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      next()
    }
  }

  const slide = SLIDES[index]!
  const fade = calm ? "" : "transition-opacity duration-500 ease-out"

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="GitQuiet product screens"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
      className="relative w-full max-w-[560px] outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c]"
    >
      <div
        className="relative overflow-hidden rounded-2xl border backdrop-blur-md sm:rounded-[20px]"
        style={{
          background: "rgba(12, 12, 12, 0.72)",
          borderColor: SCREEN_EDGE,
          boxShadow: HERO_SHADOW
        }}
      >
        {/* ~16–20px inner padding, soft ring — Luminar frame */}
        <div className="p-4 sm:p-5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#131315] ring-1 ring-white/[0.08]">
            {SLIDES.map((item, i) => {
              const active = i === index
              return (
                <img
                  key={item.src}
                  src={item.src}
                  alt={active ? item.alt : ""}
                  width={1280}
                  height={800}
                  decoding={i === 0 ? "sync" : "async"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  aria-hidden={!active}
                  className={`absolute inset-0 h-full w-full object-cover object-top ${fade} ${
                    active ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                />
              )
            })}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
          style={{ borderColor: "rgba(156,168,168,0.14)" }}
        >
          <div className="flex items-center gap-1.5" role="group" aria-label="Choose slide">
            {SLIDES.map((item, i) => (
              <button
                key={item.src}
                type="button"
                aria-current={i === index ? "true" : undefined}
                aria-label={`${item.label}: ${item.alt}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full ${calm ? "" : "transition-all"} ${
                  i === index ? "w-5 bg-white/85" : "w-2 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-1 hidden text-[12px] tabular text-white/45 sm:inline" aria-live="polite">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
            >
              <Chevron dir="next" />
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {slide.label}: {slide.alt}
      </p>
    </div>
  )
}
