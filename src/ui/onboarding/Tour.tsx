import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import type { Beat, Shot } from "./beats"
import { BEATS } from "./beats"

/**
 * The last beat, which is the only one that differs between the places this runs:
 * what a reader should do next.
 *
 * In the app it is signing in. On the site it is adding the extension. On the page the
 * extension opens when it installs itself, it is that there is nothing to do — the
 * next pull request they open is already redrawn.
 *
 * A beat like any other, so that it is one: the list below holds all of them and the
 * component never asks whether the step it is drawing exists.
 */
export type Ending = Beat & {
  /** The control that finishes it. A button, a link, or nothing at all. */
  readonly act?: ReactNode
}

/**
 * The onboarding, in one component, drawn in a window and on a page.
 *
 * A reader presses through it and can leave at any point, which is the only honest
 * shape for something nobody asked to read: a welcome, then a screen at a time, one
 * sentence under each, and a way out on every one of them.
 *
 * The pictures are the host's to draw. The site mounts the real screens and runs them,
 * because it can — they are the extension's own components with fixture data. The app
 * shows the capture of the same screen instead, which is four hundred kilobytes rather
 * than a diff engine. The extension has no copy of its own: on install it opens the
 * site's.
 */
export const Tour = ({
  show,
  ending
}: {
  readonly show: (shot: Shot) => ReactNode
  readonly ending: Ending
}) => {
  const [at, setAt] = useState(0)

  /**
   * Every beat, the host's last one included, as one list.
   *
   * One list rather than `BEATS` plus a step past the end of it, because a step past
   * the end has to be asked about at every read: the title, the sentences, the
   * picture, the dot's label and the button all become "if there is a beat here".
   */
  const steps: ReadonlyArray<Ending> = [...BEATS, ending]
  const step = steps[at] ?? ending
  const last = at === steps.length - 1

  const to = (asked: number) => setAt(Math.max(0, Math.min(steps.length - 1, asked)))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return

      // Taken rather than shared: the same press scrolled the page underneath,
      // so a reader stepping through with the keyboard moved the tour and the
      // window at once.
      event.preventDefault()

      const total = BEATS.length + 1
      setAt((was) => Math.max(0, Math.min(total - 1, was + (event.key === "ArrowRight" ? 1 : -1))))
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <section className="tour" aria-label="What GitQuiet does">
      <div
        className="tour-beat"
        /* Whether this beat has a picture, said out here rather than worked out in CSS:
           the first beat and the last one are words only, and a row kept for a picture
           that is not coming is a hole above the sentence a reader is meant to read. */
        data-shows={step.shot === undefined ? "words" : "screen"}
      >
        {/*
          Keyed by the screen rather than by the step, so two beats about one screen
          leave it where it is. The site mounts a running screen here: keyed by the step
          it was torn down and built again on every press, which pulled the eye back to
          a picture the reader had already looked at.
        */}
        {step.shot === undefined ? null : (
          <div key={step.shot} className="tour-shot">
            {show(step.shot)}
          </div>
        )}

        {/*
          The words are keyed by the step, so React builds them again on every move and
          the CSS entrance runs with them. Without the key they are one element whose
          text changes, and text that changes in place reads as a correction rather than
          as the next thing being said.
        */}
        <div key={at} className="tour-said">
          <h2 className="tour-title">{step.title}</h2>
          {step.says.map((sentence) => (
            <p key={sentence} className="tour-says">
              {sentence}
            </p>
          ))}
          {step.act !== undefined && <div className="tour-act">{step.act}</div>}
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
          {steps.map((one, which) => (
            <li key={one.title}>
              <button
                type="button"
                className="tour-dot"
                aria-current={which === at ? "step" : undefined}
                aria-label={one.title}
                onClick={() => to(which)}
              />
            </li>
          ))}
        </ol>

        {/*
          Skipping is going to the end rather than closing anything, which is what
          skipping means in both places: the last beat is the one thing a reader
          might have opened this for — signing in, or installing it. Nothing is drawn
          on the last beat itself, where both controls would say the same thing.
        */}
        <div className="tour-feet-end">
          {!last && (
            <>
              <button type="button" className="tour-quietly" onClick={() => to(steps.length - 1)}>
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
