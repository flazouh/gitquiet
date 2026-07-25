import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { useState } from "react"
import { deriveAttention } from "../attention/deriveAttention"
import { COURTS, type AttentionItem, type CourtOverride, type CourtRow } from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import { cn } from "../lib/cn"
import { CourtMenu } from "./CourtMenu"
import { Icon, courtArt, kindArt, pullRequestArt } from "./Icon"
import { Kbd } from "./Kbd"
import { Panel } from "./Panel"
import { Row } from "./Row"
import { Button } from "./button"
import { courtName, rowName, yourMoveSummary } from "./copy"

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
      <span className="block truncate text-sm text-ink">{item.title}</span>
      <span className="block truncate text-xs text-ink-dim">{item.detail}</span>
    </span>
    <CourtMenu
      label={`Court for ${item.title}`}
      value={item.court}
      onChange={(court) => onCorrect({ itemId: item.id, court })}
    />
  </li>
)

export const ControlCenter = ({ snapshot, overrides, onCorrect }: ControlCenterProps) => {
  const attention = deriveAttention(snapshot, overrides)
  const [selected, setSelected] = useState<string | null>(null)

  const selectedRow =
    attention.rows.find((row) => rowKey(row) === selected) ?? attention.rows[0] ?? null

  const needsYou = attention.yourMoveCount > 0

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-canvas p-5 text-ink">
      <header className="flex shrink-0 items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-ink-dim">
            <Icon of={pullRequestArt(snapshot.state)} size="sm" />
            <span className="tabular-nums">
              {snapshot.reference.owner}/{snapshot.reference.repo} #{snapshot.reference.number}
            </span>
            <span aria-hidden>·</span>
            <span>{attention.role === "author" ? "you opened this" : "you are reviewing"}</span>
          </p>
          <h1 className="truncate text-lg font-semibold tracking-[-0.01em]">{snapshot.title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p
            aria-live="polite"
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium tabular-nums",
              needsYou ? "bg-accent-quiet text-accent-ink" : "bg-panel text-ink-dim"
            )}
          >
            {yourMoveSummary(attention.yourMoveCount)}
          </p>
          <Button asChild variant="bare">
            <a href={toUrl(snapshot.reference)}>
              Open on GitHub
              <Icon of={ArrowUpRight01Icon} size="sm" />
            </a>
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
              tone={court === "your-move" && needsYou ? "accent" : "default"}
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
                          tone={court === "your-move" ? "accent" : "default"}
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
        <Panel
          title={`${rowName(selectedRow.kind, selectedRow.items.length)} · ${courtName(selectedRow.court)}`}
          art={kindArt[selectedRow.kind]}
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
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {selectedRow.items.map((item) => (
              <ItemLine key={item.id} item={item} onCorrect={onCorrect} />
            ))}
          </ul>
        </Panel>
      )}
    </main>
  )
}
