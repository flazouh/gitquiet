import { Effect, Option } from "effect"
import { useEffect, useState } from "react"
import type { Starring } from "../domain/repoHome"
import { wornOut } from "./worn"
import { PRESSABLE } from "./dress"

export type StarProps = {
  readonly starring: Starring
  readonly count: Option.Option<number>
  /** Stars it, or takes the star back. Rejects where GitHub refuses. */
  readonly onStar?: (to: Starring) => Effect.Effect<void, unknown>
}

/**
 * The one thing on this page a reader gives rather than reads.
 *
 * Moves before GitHub is asked, and moves back where GitHub refuses. A star is
 * a gesture, and a gesture that waits four hundred milliseconds to be
 * acknowledged is a gesture the reader has already stopped believing in. The
 * write is the slow part and it is not the part they are watching.
 *
 * The count moves with it, by one, in the direction of the press. That number
 * came from a page read some seconds ago and is already approximate on anything
 * popular, so holding it still while the star fills would be the more dishonest
 * of the two.
 */
export const Star = ({ starring, count, onStar }: StarProps) => {
  const [said, setSaid] = useState<{ readonly to: Starring; readonly at: number } | undefined>(
    undefined
  )
  const [burst, setBurst] = useState(0)

  /*
   * The press stands over the page's answer only until the page agrees with it.
   *
   * It used to stand over it forever. Nothing here ever compared the two, so a
   * star given a minute ago went on being drawn from the press whatever the page
   * said next — including on a repository the reader had since unstarred
   * somewhere else, whose read this would quietly overrule for as long as the
   * document lived. Worn out after a while as well, for the press that never gets
   * its yes at all.
   */
  const holding =
    said !== undefined && said.to !== starring && !wornOut(said.at) ? said.to : undefined

  /*
   * And dropped once it is spent, rather than merely passed over. An agreement
   * that is only skipped leaves the press sitting there, ready to be applied
   * again the moment the page's answer moves on — which would put the star back
   * on a repository the reader had since unstarred somewhere else.
   */
  useEffect(() => {
    if (said !== undefined && holding === undefined) setSaid(undefined)
  }, [said, holding])

  const showing = holding ?? starring
  if (showing === "barred") return null

  const starred = showing === "starred"
  const going: Starring = starred ? "unstarred" : "starred"

  const press = (): void => {
    setSaid({ to: going, at: Date.now() })
    // Only on the way in. Taking a star back is a correction, and a correction
    // that throws sparks reads as a celebration of the wrong thing.
    if (going === "starred") setBurst((many) => many + 1)

    const asked = onStar?.(going)
    if (asked === undefined) return

    // Back to whatever the page said, not to the opposite of the press. Those
    // differ on the second press of a pair, and the page's own answer is the
    // one that was true a moment ago.
    void Effect.runPromise(asked.pipe(Effect.catch(() => Effect.sync(() => setSaid(undefined)))))
  }

  return (
    <button
      type="button"
      onClick={press}
      aria-pressed={starred}
      className={`t-star relative inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-ink hover:bg-active ${PRESSABLE}`}
    >
      <span className="relative inline-flex">
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          key={`${starred}-${burst}`}
          // Amber once given. Primer calls this colour attention and draws their
          // own star in it; this vocabulary calls the same value busy.
          className={`t-star-mark h-3.5 w-3.5 ${starred ? "text-busy" : "text-ink-muted"}`}
          data-starred={starred ? "yes" : "no"}
        >
          <path
            fill={starred ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={starred ? 0 : 1.5}
            strokeLinejoin="round"
            d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.193L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"
          />
        </svg>
        {burst === 0 || !starred ? null : (
          // Six, keyed on the press so each one is a fresh element and the
          // animation runs again rather than being already finished.
          <span key={burst} aria-hidden className="t-star-sparks">
            {[0, 1, 2, 3, 4, 5].map((which) => (
              <i key={which} className="t-star-spark" style={{ "--spark": which } as never} />
            ))}
          </span>
        )}
      </span>
      <span>{starred ? "Starred" : "Star"}</span>
      {Option.match(count, {
        onNone: () => null,
        onSome: (many) => {
          const shown = many + (starred && starring !== "starred" ? 1 : 0) - (!starred && starring === "starred" ? 1 : 0)
          return <span className="tabular-nums text-ink-muted">{shown.toLocaleString()}</span>
        }
      })}
    </button>
  )
}
