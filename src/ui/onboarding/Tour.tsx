import type { CSSProperties, ReactNode } from "react"
import { useEffect, useState } from "react"
import { INK, MUTED, PAPER } from "../bed"
import { BEATS } from "./beats"
import { Courts } from "./Courts"

/**
 * The last beat, which is the only one that differs between the three places this
 * runs: what a reader should do next.
 *
 * In the app it is signing in. On the site it is adding the extension. On the page the
 * extension opens when it installs itself, it is that there is nothing to do — the
 * next pull request they open is already redrawn.
 */
export type Ending = {
  readonly title: string
  readonly says: ReadonlyArray<string>
  /** The control that finishes it. A button, a link, or nothing at all. */
  readonly act?: ReactNode
}

/**
 * The onboarding, in one component, drawn in a window, on a page and in a tab.
 *
 * A reader presses through it and can leave at any point, which is the only honest
 * shape for something nobody asked to read: four beats, a picture of the screen each
 * beat is about, and a way out on every one of them.
 *
 * The pictures are the host's to draw. The site mounts the real screens and runs them,
 * because it can — they are the extension's own components with fixture data. The app
 * and the extension show the capture of the same screen instead, which is four hundred
 * kilobytes rather than a diff engine.
 */
export const Tour = ({
  show,
  ending
}: {
  readonly show: (shot: string) => ReactNode
  readonly ending: Ending
}) => {
  const [at, setAt] = useState(0)

  /** Every beat, the host's last one included, so one number counts them. */
  const total = BEATS.length + 1
  const last = at === total - 1
  const beat = BEATS[at]

  const to = (step: number) => setAt(Math.max(0, Math.min(total - 1, step)))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === "ArrowRight") to(at + 1)
      if (event.key === "ArrowLeft") to(at - 1)
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // `to` closes over nothing but `total`, which cannot change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  const title = beat === undefined ? ending.title : beat.title
  const says = beat === undefined ? ending.says : beat.says

  return (
    <section
      className="tour"
      /* The brand's own three colours, handed to the stylesheet rather than written
         into it again. See `bed.ts`: they are the site's, and this is the site's
         first screen wherever it is drawn. */
      style={{ "--bed-ink": INK, "--bed-muted": MUTED, "--bed-paper": PAPER } as CSSProperties}
      aria-label="What GitQuiet does"
    >
      {/*
        Keyed by the step, so React builds this again on every move and the CSS
        entrance runs again with it. Without the key it is one element whose text
        changes, and text that changes in place reads as a correction rather than as
        the next thing being said.
      */}
      <div key={at} className="tour-beat">
        {beat?.shot === undefined ? null : <div className="tour-shot">{show(beat.shot)}</div>}

        <div className="tour-said">
          <p className="tour-count">
            {at + 1} of {total}
          </p>
          <h2 className="tour-title">{title}</h2>
          {says.map((sentence) => (
            <p key={sentence} className="tour-says">
              {sentence}
            </p>
          ))}
          {beat?.courts === true && <Courts />}
          {last && ending.act !== undefined && <div className="tour-act">{ending.act}</div>}
        </div>
      </div>

      <footer className="tour-feet">
        <div className="tour-feet-start">
          {at > 0 && (
            <button type="button" className="tour-quietly" onClick={() => to(at - 1)}>
              Back
            </button>
          )}
        </div>

        {/*
          Pressable, because a reader who has read the four beats and wants the second
          one again should not have to press Back three times. Named by their titles
          rather than by their numbers, for anybody reading this with their ears.
        */}
        <ol className="tour-dots">
          {Array.from({ length: total }, (_, step) => (
            <li key={step}>
              <button
                type="button"
                className="tour-dot"
                aria-current={step === at ? "step" : undefined}
                aria-label={BEATS[step]?.title ?? ending.title}
                onClick={() => to(step)}
              />
            </li>
          ))}
        </ol>

        {/*
          Skipping is going to the end rather than closing anything, which is what
          skipping means in all three places: the last beat is the one thing a reader
          might have opened this for — signing in, or installing it. Nothing is drawn
          on the last beat itself, where both controls would say the same thing.
        */}
        <div className="tour-feet-end">
          {!last && (
            <>
              <button type="button" className="tour-quietly" onClick={() => to(total - 1)}>
                Skip
              </button>
              <button type="button" className="tour-press" onClick={() => to(at + 1)}>
                Next
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  )
}
