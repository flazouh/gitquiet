import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"

/**
 * Hero product carousel — five real screenshots, edge-to-edge in the poster.
 *
 * Auto-advances every 5s unless the user prefers reduced motion, or the frame
 * is hovered / focused. Prev / next + dots overlay the image; arrow keys when focused.
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
      className="relative h-full w-full max-w-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25"
    >
      <div className="relative aspect-[16/10] h-full overflow-hidden bg-[#131315] md:aspect-auto md:min-h-[28rem]">
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

        {/* Controls overlay — no bordered chrome bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/45 via-black/15 to-transparent px-4 pb-4 pt-14 sm:px-5 sm:pb-5">
          <div className="pointer-events-auto flex items-center gap-1.5" role="group" aria-label="Choose slide">
            {SLIDES.map((item, i) => (
              <button
                key={item.src}
                type="button"
                aria-current={i === index ? "true" : undefined}
                aria-label={`${item.label}: ${item.alt}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full ${calm ? "" : "transition-all"} ${
                  i === index ? "w-5 bg-white/90" : "w-2 bg-white/40 hover:bg-white/65"
                }`}
              />
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <span className="mr-1 hidden text-[12px] tabular text-white/70 sm:inline">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white/90 backdrop-blur-sm hover:bg-black/50 hover:text-white"
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white/90 backdrop-blur-sm hover:bg-black/50 hover:text-white"
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
