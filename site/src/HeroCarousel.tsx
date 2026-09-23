import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react"
import type { HeroLiveScene } from "./HeroStage"
/**
 * Hero product carousel — flush-right screenshot embed with light prev/next
 * UNDER the frame, left-aligned to the shot left edge. Frame is rounded on
 * the left only (tighter radius; right edge square and flush to the poster
 * clip). No border/ring/chrome well. Fixed 16/10 aspect; shots fill with
 * object-cover object-top. Stack (shot then controls) on all breakpoints.
 *
 * Phase 3 of #100: Inbox + Pull request + Review + Repo mount live fixture UI
 * (Held + Supplied); Peek stays on PNG until Phase 4. Stage is dynamic-imported
 * and mounted only while its slide is active. Autoplay waits on live `onReady`
 * so a slow PR/Review paint never advances mid-blank.
 */

type Slide = {
  readonly src: string
  readonly alt: string
  readonly label: string
  readonly live?: HeroLiveScene
}

const SLIDES: ReadonlyArray<Slide> = [
  {
    src: "/hero/inbox.png",
    alt: "GitQuiet pull request inbox",
    label: "Inbox",
    live: "working-set"
  },
  {
    src: "/hero/pull-request.png",
    alt: "Pull request with files and diff",
    label: "Pull request",
    live: "pull-request"
  },
  {
    src: "/hero/review.png",
    alt: "Review mode stepping through changes",
    label: "Review",
    live: "pull-request-review"
  },
  {
    src: "/hero/peek.png",
    alt: "Peek at a symbol in the file",
    label: "Peek"
  },
  {
    src: "/hero/repo.png",
    alt: "Repository home",
    label: "Repo",
    live: "repo-home"
  }
]

const INTERVAL_MS = 5000

const HeroStage = lazy(() => import("./HeroStage"))

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

const controlClass =
  "inline-flex h-8 items-center gap-1 rounded-md bg-white/90 px-3 text-[11px] font-medium tracking-wide text-neutral-800 shadow-sm ring-1 ring-black/5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"

export const HeroCarousel = () => {
  const calm = useCalm()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [liveReady, setLiveReady] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const count = SLIDES.length
  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  )
  const prev = useCallback(() => go(index - 1), [go, index])
  const next = useCallback(() => go(index + 1), [go, index])

  const slide = SLIDES[index]!

  useEffect(() => {
    setLiveReady(false)
  }, [index])

  useEffect(() => {
    if (calm || paused) return
    /*
     * Hold the interval while a live scene is still painting. PNG slides and
     * ready live scenes get a full INTERVAL_MS; once onReady fires the effect
     * restarts so the painted frame is not cut short by time spent waiting.
     */
    if (slide.live !== undefined && !liveReady) return
    const tick = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, INTERVAL_MS)
    return () => window.clearInterval(tick)
  }, [calm, paused, count, slide.live, liveReady])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      prev()
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      next()
    }
  }

  const fade = calm ? "" : "transition-opacity duration-500 ease-out"
  const onLiveReady = useCallback(() => setLiveReady(true), [])

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
      className="relative flex w-full max-w-none flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/25"
    >
      {/* Flush-right embed: small left-only radius, square right, no border/ring */}
      <div className="relative aspect-[16/10] w-full min-w-0 overflow-hidden rounded-l-sm rounded-r-none">
        {SLIDES.map((item, i) => {
          const active = i === index
          const hidePng = active && item.live !== undefined && liveReady
          return (
            <img
              key={item.src}
              src={item.src}
              alt={active ? item.alt : ""}
              width={1280}
              height={800}
              decoding={i === 0 ? "sync" : "async"}
              fetchPriority={i === 0 ? "high" : "low"}
              aria-hidden={!active || hidePng}
              className={`absolute inset-0 h-full w-full object-cover object-top ${fade} ${
                active && !hidePng ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
          )
        })}

        {slide.live !== undefined ? (
          <Suspense fallback={null}>
            <HeroStage key={slide.live} scene={slide.live} onReady={onLiveReady} />
          </Suspense>
        ) : null}

      </div>

      {/* Light prev/next — under the shot, left-aligned to the frame left edge */}
      <div className="flex shrink-0 items-center justify-start gap-1.5">
        <button type="button" aria-label="Previous slide" onClick={prev} className={controlClass}>
          <Chevron dir="prev" />
          Prev
        </button>
        <button type="button" aria-label="Next slide" onClick={next} className={controlClass}>
          Next
          <Chevron dir="next" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {slide.label}: {slide.alt}
      </p>
    </div>
  )
}
