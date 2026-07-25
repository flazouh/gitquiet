import { useState } from "react"
import type { AttentionItem, Court, CourtOverride, CourtRow } from "../domain/Attention"
import { COURTS } from "../domain/Attention"
import { deriveAttention } from "../attention/deriveAttention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import { Button } from "./button"
import { courtName, rowName, yourMoveSummary } from "./copy"

export type ControlCenterProps = {
  readonly snapshot: PullRequestSnapshot
  readonly overrides: ReadonlyArray<CourtOverride>
  readonly onCorrect: (override: CourtOverride) => void
}

const rowKey = (row: CourtRow): string => `${row.court}:${row.kind}`

const CourtColumn = ({
  court,
  rows,
  selected,
  onSelect
}: {
  readonly court: Court
  readonly rows: ReadonlyArray<CourtRow>
  readonly selected: string | null
  readonly onSelect: (key: string) => void
}) => (
  <section aria-label={courtName(court)} className="flex min-w-0 flex-col gap-2">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {courtName(court)}
    </h2>
    {rows.length === 0 ? (
      <p className="text-sm text-neutral-400">Empty</p>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const key = rowKey(row)
          const isSelected = key === selected
          const [first] = row.items
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={isSelected}
                onClick={() => onSelect(key)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <span className="block text-sm font-medium text-neutral-900">
                  {rowName(row.kind, row.items.length)}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {first?.title ?? ""}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )}
  </section>
)

const ItemDetail = ({
  row,
  onCorrect
}: {
  readonly row: CourtRow
  readonly onCorrect: (override: CourtOverride) => void
}) => (
  <section
    aria-label={`${rowName(row.kind, row.items.length)} in ${courtName(row.court)}`}
    className="flex min-h-0 flex-col gap-2"
  >
    <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {rowName(row.kind, row.items.length)} · {courtName(row.court)}
    </h2>
    <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
      {row.items.map((item) => (
        <ItemLine key={item.id} item={item} onCorrect={onCorrect} />
      ))}
    </ul>
  </section>
)

const ItemLine = ({
  item,
  onCorrect
}: {
  readonly item: AttentionItem
  readonly onCorrect: (override: CourtOverride) => void
}) => (
  <li className="flex items-center justify-between gap-4 py-1.5">
    <span className="min-w-0">
      <span className="block truncate text-sm text-neutral-900">{item.title}</span>
      <span className="block truncate text-xs text-neutral-500">{item.detail}</span>
    </span>
    {/* Labelled by attribute rather than an element: an off-screen label would
        be positioned against the document and give the page 11px to scroll. */}
    <select
      aria-label={`Court for ${item.title}`}
      value={item.court}
      onChange={(event) => {
        const court = COURTS.find((candidate) => candidate === event.target.value)
        if (court !== undefined) onCorrect({ itemId: item.id, court })
      }}
      className="shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-700"
    >
      {COURTS.map((court) => (
        <option key={court} value={court}>
          {courtName(court)}
        </option>
      ))}
    </select>
  </li>
)

export const ControlCenter = ({ snapshot, overrides, onCorrect }: ControlCenterProps) => {
  const attention = deriveAttention(snapshot, overrides)
  const [selected, setSelected] = useState<string | null>(null)

  const selectedRow =
    attention.rows.find((row) => rowKey(row) === selected) ?? attention.rows[0] ?? null

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-white p-6 text-neutral-900">
      <header className="flex shrink-0 items-baseline justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">
            {snapshot.reference.owner}/{snapshot.reference.repo} #{snapshot.reference.number}
            {" · "}
            {attention.role === "author" ? "you opened this" : "you are reviewing"}
          </p>
          <h1 className="truncate text-xl font-semibold">{snapshot.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p aria-live="polite" className="text-sm font-medium">
            {yourMoveSummary(attention.yourMoveCount)}
          </p>
          <Button asChild variant="outline" size="sm">
            <a href={toUrl(snapshot.reference)}>Open on GitHub</a>
          </Button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-3 gap-6">
        {COURTS.map((court) => (
          <CourtColumn
            key={court}
            court={court}
            rows={attention.rows.filter((row) => row.court === court)}
            selected={selectedRow === null ? null : rowKey(selectedRow)}
            onSelect={setSelected}
          />
        ))}
      </div>

      {selectedRow === null ? null : (
        <div className="flex min-h-0 flex-1 border-t border-neutral-200 pt-4">
          <ItemDetail row={selectedRow} onCorrect={onCorrect} />
        </div>
      )}
    </main>
  )
}
