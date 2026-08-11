import { Effect, Fiber } from "effect"
import { useEffect, useState } from "react"

import { useArt } from "./art"
import { PRESSABLE } from "./dress"
import { Menu, type Row } from "./Menu"

/**
 * The way a screen reads the repository's branches.
 *
 * Two stages like everything else here: the kept list first, so the picker opens
 * full on every visit after the first, then GitHub's answer behind it.
 */
export type LoadBranches = (
  partly: (branches: ReadonlyArray<string>) => void
) => Effect.Effect<ReadonlyArray<string>, unknown>

/**
 * Which branch this page of commits is of, and the way to another.
 *
 * A picker rather than a label, which is what their own page has here and what
 * the page is missing without it: a reader on `main` who wants to see what
 * landed on a release branch has, otherwise, to edit the address.
 *
 * Nothing is read until it is opened. A repository has a thousand branches, the
 * route answers with all of them at twenty-two kilobytes, and a page that spent
 * that on the chance somebody presses this is a page paying for a control most
 * readers never touch. Opened once, the answer is kept, and every open after
 * that is instant — the branch pushed since is what the live read adds.
 */
export const Branches = ({
  at,
  on,
  load,
  onGo,
  dress = `flex items-center gap-1 px-2 py-1 text-sm text-ink hover:bg-active ${PRESSABLE}`
}: {
  /**
   * Where a branch is read, which every screen answers differently: the history
   * keeps its filters across the change and this page has none to keep.
   */
  readonly at: (branch: string) => string
  /** The branch GitHub resolved, which is the one to show as chosen. */
  readonly on: string
  readonly load?: LoadBranches
  /**
   * How to go there, which is this screen's own business rather than the
   * browser's: GitHub navigates within a repository without loading a page, so
   * a plain link changes the address and leaves this list showing the branch it
   * was already on.
   */
  readonly onGo: (path: string) => void
  /** How the control is dressed, where the row it stands in has its own idea. */
  readonly dress?: string
}) => {
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState(false)
  const [names, setNames] = useState<ReadonlyArray<string>>([])
  const Down = useArt()["chevron-down"]

  useEffect(() => {
    if (!asked || load === undefined) return

    let watching = true
    const reading = Effect.runFork(
      load((found) => {
        if (watching) setNames(found)
      }).pipe(
        Effect.map((found) => {
          if (watching) setNames(found)
        }),
        // A picker that cannot read the branches is a picker showing the one
        // branch it already knows, which is what the control said before it was
        // pressed. Nothing to report and nobody to tell.
        Effect.orElseSucceed(() => {})
      )
    )

    return () => {
      watching = false
      Effect.runFork(Fiber.interrupt(reading))
    }
  }, [asked, load])

  const rows: ReadonlyArray<Row> = names.map((name) => {
    const where = at(name)
    return { name, where, press: () => onGo(where), chosen: name === on }
  })

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Branch: ${on}`}
        aria-expanded={open}
        className={dress}
        onClick={() => {
          setAsked(true)
          setOpen((was) => !was)
        }}
      >
        <span className="font-mono text-xs">{on}</span>
        <Down size={12} className="text-ink-muted" />
      </button>
      <Menu
        name="Branches"
        open={open}
        onShut={() => setOpen(false)}
        rows={rows}
        origin="top-left"
        wide="w-72"
        find="Find a branch"
      />
    </div>
  )
}
