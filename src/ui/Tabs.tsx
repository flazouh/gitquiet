import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import type { Art } from "./Icon"

export type View = {
  readonly name: string
  readonly art: Art
  /** Shown beside the name, in GitHub's own counter, when there is anything to count. */
  readonly count?: number
  readonly panel: () => ReactNode
}

export type TabsProps = {
  readonly views: ReadonlyArray<View>
  readonly label: string
}

const Counter = ({ count }: { readonly count: number | undefined }) =>
  count === undefined || count === 0 ? null : <span className="Counter">{count}</span>

export const Tabs = ({ views, label }: TabsProps) => {
  const [current, setCurrent] = useState(0)
  const group = useId()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])

  // Arrow keys move the selection itself, which is the pattern for tabs whose
  // panels are cheap to show: nobody arrows past a tab they meant to open only
  // to have to press Enter to actually get there.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const to =
      step === 0
        ? event.key === "Home"
          ? 0
          : event.key === "End"
            ? views.length - 1
            : null
        : (current + step + views.length) % views.length
    if (to === null) return

    event.preventDefault()
    setCurrent(to)
    tabs.current[to]?.focus()
  }

  const view = views[current]

  return (
    <div className="flex flex-col">
      {/* Their own tab nav, above ours, is hidden by the takeover: two rows of
          tabs on one page would be two answers to the same question. */}
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 border-b border-line"
      >
        {views.map((candidate, index) => {
          const selected = index === current
          const Art = candidate.art

          return (
            <button
              key={candidate.name}
              ref={(element) => {
                tabs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${group}-tab-${index}`}
              aria-controls={`${group}-panel-${index}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setCurrent(index)}
              // A button on this page is a grey box with the user agent's own
              // font until told otherwise: Tailwind's utilities are here
              // without its reset, deliberately, so that GitHub's styles keep
              // winning everywhere we have no opinion.
              className={`-mb-px flex appearance-none items-center gap-2 border-b-2 bg-transparent px-3 py-2 font-sans text-sm text-inherit hover:bg-hover ${
                selected
                  ? "border-line-accent font-semibold"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <Art className="shrink-0" />
              {candidate.name}
              <Counter count={candidate.count} />
            </button>
          )
        })}
      </div>

      {view === undefined ? null : (
        <div
          role="tabpanel"
          id={`${group}-panel-${current}`}
          // Named by its tab, count and all, so a screen reader and the eye
          // are told the same thing about where they are.
          aria-labelledby={`${group}-tab-${current}`}
          tabIndex={0}
          className="pt-4"
        >
          {view.panel()}
        </div>
      )}
    </div>
  )
}
