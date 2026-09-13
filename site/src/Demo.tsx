import { useCallback, useEffect, useRef, useState } from "react"

const SRC = "/demo.mp4"
const POSTER = "/demo-poster.jpg"

const format = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/**
 * The landing demo: a custom chrome over one loop, no native controls.
 *
 * Native controls fight the dark page and look like a different product. This
 * one is a quiet bar — play, scrub, time — so the clip stays the point.
 */
export const Demo = () => {
  const video = useRef<HTMLVideoElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [hover, setHover] = useState(false)
  const [ready, setReady] = useState(false)

  const toggle = useCallback(() => {
    const node = video.current
    if (node === null) return
    if (node.paused) void node.play()
    else node.pause()
  }, [])

  useEffect(() => {
    const node = video.current
    if (node === null) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setTime(node.currentTime)
    const onMeta = () => {
      setDuration(node.duration)
      setReady(true)
    }

    node.addEventListener("play", onPlay)
    node.addEventListener("pause", onPause)
    node.addEventListener("timeupdate", onTime)
    node.addEventListener("loadedmetadata", onMeta)
    return () => {
      node.removeEventListener("play", onPlay)
      node.removeEventListener("pause", onPause)
      node.removeEventListener("timeupdate", onTime)
      node.removeEventListener("loadedmetadata", onMeta)
    }
  }, [])

  const seek = (clientX: number) => {
    const node = video.current
    const track = bar.current
    if (node === null || track === null || duration <= 0) return
    const box = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    node.currentTime = ratio * duration
    setTime(node.currentTime)
  }

  const progress = duration > 0 ? time / duration : 0
  const showChrome = hover || !playing || !ready

  return (
    <div
      className="group relative isolate overflow-hidden rounded-2xl bg-[#16141c]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <video
        ref={video}
        className="block aspect-[1280/926] w-full bg-black object-cover"
        src={SRC}
        poster={POSTER}
        playsInline
        preload="metadata"
        loop
        muted
        onClick={toggle}
        aria-label="GitQuiet product demo"
      />

      {/* Big play when paused */}
      {!playing ? (
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition-opacity duration-200"
          aria-label="Play demo"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#0c0b10] shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 sm:h-20 sm:w-20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72L19 12 8 5.14Z" />
            </svg>
          </span>
        </button>
      ) : null}

      {/* Bottom chrome */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-12 transition-opacity duration-200 sm:px-4 sm:pb-4 ${
          showChrome ? "opacity-100" : "opacity-0 group-focus-within:opacity-100"
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.14v13.72L19 12 8 5.14Z" />
              </svg>
            )}
          </button>

          <div
            ref={bar}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(time)}
            tabIndex={0}
            className="relative h-5 flex-1 cursor-pointer"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              seek(event.clientX)
            }}
            onPointerMove={(event) => {
              if (event.buttons !== 1) return
              seek(event.clientX)
            }}
            onKeyDown={(event) => {
              const node = video.current
              if (node === null) return
              if (event.key === "ArrowRight") node.currentTime = Math.min(duration, node.currentTime + 5)
              if (event.key === "ArrowLeft") node.currentTime = Math.max(0, node.currentTime - 5)
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <span className="shrink-0 tabular text-[12px] text-white/70 sm:text-[13px]">
            {format(time)}
            <span className="text-white/35"> / </span>
            {format(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
