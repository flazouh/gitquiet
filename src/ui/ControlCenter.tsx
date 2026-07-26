import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { useState } from "react"
import { deriveAttention } from "../attention/deriveAttention"
import { COURTS, type AttentionItem, type CourtOverride, type CourtRow } from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import { Button } from "../components/ui/button"
import { ScrollArea } from "../components/ui/scroll-area"
import { Tooltip } from "../components/ui/tooltip"
import { cn } from "../lib/utils"
import { CourtMenu } from "./CourtMenu"
import { Icon, asIcon, courtArt, kindArt, pullRequestArt } from "./Icon"
import { Kbd } from "./Kbd"
import { Panel } from "./Panel"
import { Row } from "./Row"
import { courtName, rowName, yourMoveSummary } from "./copy"
import { useRevealed, useTextSwap } from "./motion"

export type ControlCenterProps = {
  readonly snapshot: PullRequestSnapshot
  readonly overrides: ReadonlyArray<CourtOverride>
  readonly onCorrect: (override: CourtOverride) => void
}

const rowKey = (row: CourtRow): string => `${row.court}:${row.kind}`

const ItemLine = ({
  item,
  onCorrect
}: {
  readonly item: AttentionItem
  readonly onCorrect: (override: CourtOverride) => void
}) => (
  <li className="group/item flex items-center justify-between gap-4 rounded-md px-2 py-1.5 transition-colors duration-instant ease-out hover:bg-panel-hover">
    <span className="min-w-0">
      {/* Paths and comment summaries are the things most likely to be cut off,
          and the full text is exactly what decides whether to open the item. */}
      <Tooltip content={item.title} side="top">
        <span className="block truncate text-sm text-ink">{item.title}</span>
      </Tooltip>
      <span className="block truncate text-xs text-ink-dim">{item.detail}</span>
    </span>
    <CourtMenu
      label={`Court for ${item.title}`}
      value={item.court}
      onChange={(court) => onCorrect({ itemId: item.id, court })}
    />
  </li>
)

/**
 * What the selected Control Center row contains, one line per Attention Item.
 * Mounted fresh for each row — keyed by the caller — so choosing a different
 * row plays the reveal again rather than silently exchanging the contents.
 */
const DetailPanel = ({
  row,
  onCorrect
}: {
  readonly row: CourtRow
  readonly onCorrect: (override: CourtOverride) => void
}) => {
  const revealed = useRevealed()

  return (
    <div className="t-panel-slide flex min-h-0 flex-1 flex-col" data-open={revealed}>
      <Panel
        title={`${rowName(row.kind, row.items.length)} · ${courtName(row.court)}`}
        art={kindArt[row.kind]}
        className="min-h-0 flex-1 rounded-lg bg-surface p-3"
        aside={
          <span className="flex items-center gap-1.5 text-2xs text-ink-dim">
            <Kbd>n</Kbd>
            <span>next</span>
            <Kbd>esc</Kbd>
            <span>back</span>
          </span>
        }
      >
        <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-1">
          {/* Two columns, because one line per item across the full width leaves
              a path stranded from the control that acts on it, and halves how
              much of a long Queue is on screen at once. */}
          <ul className="grid grid-cols-2 gap-x-4">
            {row.items.map((item) => (
              <ItemLine key={item.id} item={item} onCorrect={onCorrect} />
            ))}
          </ul>
        </ScrollArea>
      </Panel>
    </div>
  )
}

export const ControlCenter = ({ snapshot, overrides, onCorrect }: ControlCenterProps) => {
  const attention = deriveAttention(snapshot, overrides)
  const [selected, setSelected] = useState<string | null>(null)
  const revealed = useRevealed()
  const summary = useTextSwap(yourMoveSummary(attention.yourMoveCount))

  const selectedRow =
    attention.rows.find((row) => rowKey(row) === selected) ?? attention.rows[0] ?? null

  const needsYou = attention.yourMoveCount > 0

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-canvas p-5 text-ink">
      <header className="flex shrink-0 items-start justify-between gap-6">
        {/* The two lines rise in sequence on arrival, so the eye lands on which
            pull request this is before the title it carries. */}
        <div className={cn("t-stagger min-w-0", revealed && "is-shown")}>
          <p className="t-stagger-line t-stagger-line--1 flex items-center gap-1.5 text-xs text-ink-dim">
            <Icon of={pullRequestArt(snapshot.state)} size="sm" />
            <span className="tabular-nums">
              {snapshot.reference.owner}/{snapshot.reference.repo} #{snapshot.reference.number}
            </span>
            <span aria-hidden>·</span>
            <span>{attention.role === "author" ? "you opened this" : "you are reviewing"}</span>
          </p>
          <h1 className="t-stagger-line t-stagger-line--2 truncate text-lg font-semibold tracking-[-0.01em]">
            {snapshot.title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p
            aria-live="polite"
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium tabular-nums",
              needsYou ? "bg-brand-quiet text-brand-ink" : "bg-panel text-ink-dim"
            )}
          >
            {/* Swapped in place rather than re-rendered: the count is the one
                number the Participant is tracking, and a silent change is easy
                to miss when a correction is what caused it. */}
            <span ref={summary.ref} className="t-text-swap">
              {summary.shown}
            </span>
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            trailingIcon={asIcon(ArrowUpRight01Icon)}
          >
            <a href={toUrl(snapshot.reference)}>Open on GitHub</a>
          </Button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-3 gap-4">
        {COURTS.map((court) => {
          const rows = attention.rows.filter((row) => row.court === court)
          const items = rows.reduce((total, row) => total + row.items.length, 0)
          return (
            <Panel
              key={court}
              title={courtName(court)}
              art={courtArt[court]}
              count={items}
              tone={court === "your-move" && needsYou ? "brand" : "default"}
            >
              {rows.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-ink-dim">Nothing here</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {rows.map((row) => {
                    const key = rowKey(row)
                    const [first] = row.items
                    return (
                      <li key={key}>
                        <Row
                          art={kindArt[row.kind]}
                          label={rowName(row.kind, row.items.length)}
                          meta={first?.title}
                          tone={court === "your-move" ? "brand" : "default"}
                          selected={selectedRow !== null && rowKey(selectedRow) === key}
                          onSelect={() => setSelected(key)}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>
          )
        })}
      </div>

      {selectedRow === null ? null : (
        <DetailPanel
          key={rowKey(selectedRow)}
          row={selectedRow}
          onCorrect={onCorrect}
        />
      )}
    </main>
  )
}
