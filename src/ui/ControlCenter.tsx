import { ChevronRightIcon } from "@primer/octicons-react"
import { deriveAttention } from "../attention/deriveAttention"
import {
  COURTS,
  type AttentionItem,
  type Court,
  type CourtOverride,
  type CourtRow
} from "../domain/Attention"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { CourtMenu } from "./CourtMenu"
import { courtArt, kindArt } from "./Icon"
import { courtName, rowName, yourMoveSummary } from "./copy"

export type ControlCenterProps = {
  readonly snapshot: PullRequestSnapshot
  readonly overrides: ReadonlyArray<CourtOverride>
  readonly onCorrect: (override: CourtOverride) => void
}

/**
 * One indent ladder, so the three depths line up rather than nearly lining up.
 *
 * A Court's name, a group's name and an item all start where the text of the
 * line above them starts: 16px in for a header, and each icon and its gap
 * pushing the next depth 24px further. Written down because the alternative is
 * four components each guessing, and guessing is what made the last version
 * look approximate.
 */
const EDGE = "px-4"
const ITEM_INDENT = "pl-16"

/** How GitHub tints the same three states a few hundred pixels above this. */
const courtTint: Record<Court, string> = {
  "your-move": "text-ink-accent",
  "waiting-on-others": "text-busy",
  settled: "text-pass"
}

const ItemLine = ({
  item,
  onCorrect
}: {
  readonly item: AttentionItem
  readonly onCorrect: (override: CourtOverride) => void
}) => (
  // One line each, with what it is on the left and what it amounts to on the
  // right, which is how GitHub lists files and checks a few hundred pixels
  // above this. Two lines per item would double the height of a Court for
  // detail nobody reads until they open the thing.
  <li
    className={`group/item flex min-h-8 items-center gap-3 py-1 pr-2 ${ITEM_INDENT} hover:bg-hover`}
  >
    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
    <span className="shrink-0 text-xs text-ink-muted tabular-nums">{item.detail}</span>
    <CourtMenu
      label={`Court for ${item.title}`}
      value={item.court}
      onChange={(court) => onCorrect({ itemId: item.id, court })}
    />
  </li>
)

/**
 * One kind of thing within one Court, as a group that opens.
 *
 * Closed, it is a single line saying how many and giving the first one, which
 * is the bird's-eye view. Open, it is every item. A pull request with a hundred
 * and fifty five Attention Items is the case that matters, and it is why the
 * items are behind a disclosure rather than listed: the wall of comments is the
 * problem, not the format.
 *
 * `<details>` because GitHub uses it everywhere and because it keeps working
 * before any of our JavaScript does.
 */
const Group = ({
  row,
  open,
  onCorrect
}: {
  readonly row: CourtRow
  readonly open: boolean
  readonly onCorrect: (override: CourtOverride) => void
}) => {
  const Art = kindArt[row.kind]
  const [first] = row.items

  return (
    <details open={open} className="group/details border-b border-line-muted last:border-b-0">
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 ${EDGE} py-2 hover:bg-hover [&::-webkit-details-marker]:hidden`}
      >
        <ChevronRightIcon className="shrink-0 text-ink-muted transition-transform duration-150 group-open/details:rotate-90" />
        <Art className="shrink-0 text-ink-muted" />
        <span className="shrink-0 text-sm font-semibold">{rowName(row.kind, row.items.length)}</span>
        {/* The first one, so a folded group still says something specific. It
            disappears once the group is open, where it would be a duplicate of
            the line directly beneath it. */}
        {first === undefined ? null : (
          <span className="truncate text-sm text-ink-muted group-open/details:hidden">
            {first.title}
          </span>
        )}
      </summary>
      <ul className="pb-2">
        {row.items.map((item) => (
          <ItemLine key={item.id} item={item} onCorrect={onCorrect} />
        ))}
      </ul>
    </details>
  )
}

const CourtSection = ({
  court,
  rows,
  onCorrect
}: {
  readonly court: Court
  readonly rows: ReadonlyArray<CourtRow>
  readonly onCorrect: (override: CourtOverride) => void
}) => {
  const Art = courtArt[court]
  const items = rows.reduce((total, row) => total + row.items.length, 0)
  const yourMove = court === "your-move"

  return (
    <section aria-label={courtName(court)} className="Box">
      <div
        className={`flex items-center gap-2 rounded-t-md border-b border-line bg-surface ${EDGE} py-2.5`}
      >
        {/* Tinted only when the Court has something in it: three coloured icons
            on a page where two of them mean nothing is just decoration. */}
        <Art className={`shrink-0 ${items === 0 ? "text-ink-muted" : courtTint[court]}`} />
        <h3 className="text-sm font-semibold">{courtName(court)}</h3>
        <span className="Counter">{items}</span>
      </div>
      {rows.length === 0 ? (
        <p className={`${EDGE} py-2.5 text-sm text-ink-muted`}>
          {yourMove ? "Nothing needs you here" : "Nothing here"}
        </p>
      ) : (
        // Only what needs the Participant is open on arrival. The other two
        // Courts are there to be checked, not read.
        rows.map((row) => (
          <Group
            key={`${row.court}:${row.kind}`}
            row={row}
            open={yourMove}
            onCorrect={onCorrect}
          />
        ))
      )}
    </section>
  )
}

export const ControlCenter = ({ snapshot, overrides, onCorrect }: ControlCenterProps) => {
  const attention = deriveAttention(snapshot, overrides)

  return (
    <div className="flex flex-col gap-4 pt-1 pb-8">
      <div className="flex items-baseline gap-2">
        <h2 aria-live="polite" className="text-lg font-semibold">
          {yourMoveSummary(attention.yourMoveCount)}
        </h2>
        <p className="text-sm text-ink-muted">
          {attention.role === "author" ? "you opened this" : "you are reviewing"}
        </p>
      </div>

      {COURTS.map((court) => (
        <CourtSection
          key={court}
          court={court}
          rows={attention.rows.filter((row) => row.court === court)}
          onCorrect={onCorrect}
        />
      ))}
    </div>
  )
}
