import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"

/**
 * Hero product carousel — screenshot well + compact prev/next.
 * Image is scaled ~4/3 so ~3/4 of the bitmap fills the frame (rest clipped
 * under the bezel); object-top keeps chrome. Fixed 16/10 frame. Flush to the
 * poster’s right edge on md+ (parent pins the stack).
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
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="block">
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
      className="relative w-full max-w-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25"
    >
      <div className="overflow-hidden rounded-[11px] bg-[rgba(12,12,12,0.72)] ring-1 ring-white/[0.10]">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#131315]">
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
                className={`absolute left-1/2 top-0 h-[133%] w-[133%] max-w-none -translate-x-1/2 object-cover object-top ${fade} ${
                  active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              />
            )
          })}
        </div>

        <div
          className="flex items-center justify-end gap-1.5 border-t px-3 py-2"
          style={{ borderColor: "rgba(156,168,168,0.14)" }}
        >
          <button
            type="button"
            aria-label="Previous slide"
            onClick={prev}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 text-[11px] font-medium tracking-wide text-white/75 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
          >
            <Chevron dir="prev" />
            Prev
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={next}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 text-[11px] font-medium tracking-wide text-white/75 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
          >
            Next
            <Chevron dir="next" />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {slide.label}: {slide.alt}
      </p>
    </div>
  )
}
