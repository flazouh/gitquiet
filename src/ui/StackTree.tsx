import { Option } from "effect"
import type { CSSProperties } from "react"
import type { Chain, PullRequestState, StackLayer } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { aroundHere, holdingItUp, whichLayer, wouldLand } from "../domain/pressing"
import type { Size } from "../domain/workingSet"
import { pullRequestName, useArt } from "./art"
import { CHIP } from "./dress"
import type { LayerSizes } from "./useLayerSizes"

/**
 * How many rows a header has room for before the pull request goes off screen.
 *
 * Five holds the reader's own layer with two of its neighbours either side,
 * which is enough to see what a stack is shaped like. The longest chain in
 * GitHub's own preview feedback is twenty two, and twenty two rows above a title
 * is a second page rather than a header.
 *
 * Exported for the one caller that has to know what this tree will draw before
 * it is drawn: the strip counts the lines of the rows in the window and of no
 * others, a count being a request each. See `Proposed`.
 */
export const ROOM = 5

const BADGE: Partial<Record<PullRequestState, string>> = {
  draft: "Draft",
  merged: "Merged",
  closed: "Closed"
}

const TONE: Partial<Record<PullRequestState, string>> = {
  draft: "text-ink-muted",
  merged: "text-done",
  closed: "text-fail"
}

const pathTo = (reference: PullRequestRef): string =>
  `/${reference.owner}/${reference.repo}/pull/${reference.number}`

/** The tier a row is stepped in by, carried as a number the stylesheet multiplies. */
const steppedIn = (tier: number): CSSProperties =>
  ({ "--stack-tier": String(tier) }) as CSSProperties

/**
 * What a row is dressed in.
 *
 * `w-fit` and not the full width the grid offers. A row of this tree is three
 * short words, and a fill running the whole way across the card under a
 * three-word row reads as a second well rather than as one row of a list. It
 * still gives the width back on a long title, which `max-w-full` and the
 * `min-w-0` on the title between them let truncate.
 */
const ROW =
  "t-stack-row flex w-fit min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1 text-xs"

/**
 * How big one layer is, in the two colours every diff in this interface wears.
 *
 * A real minus sign and not a hyphen, as the header's own pair carries: beside a
 * plus, a hyphen reads as the dash between two numbers rather than as lines
 * taken away.
 *
 * At the trailing edge of the row, and nothing holds a place for it. That is
 * what lets a count arrive late without moving anything: everything a row says
 * stands at its leading edge, the row is only as wide as its content, and the
 * strip is as wide as the page — so a count lands in space no row was using and
 * the row grows to the right. A place held for one instead would be eighty
 * pixels of empty row on every layer for as long as GitHub takes to answer, and
 * the row the reader is standing on is filled and would show it. The rows are
 * linking up while these arrive, which is the whole reason it matters.
 *
 * Ragged rather than in a column, unlike the size on a Working Set row, which is
 * a track of a grid and lines up with the row above it. Nothing in this tree
 * lines up: every row is stepped in from the one it sits on, and the staircase
 * is what says which layer sits on which.
 */
const Lines = ({ size }: { readonly size: Size }) => (
  <span
    // Said in words, because "+120 −8" read out is punctuation. The same
    // sentence a Working Set row gives its own pair.
    aria-label={`${size.added} added, ${size.deleted} removed`}
    className="flex shrink-0 gap-1 tabular-nums"
  >
    <span className="text-pass">{`+${size.added}`}</span>
    <span className="text-fail">{`−${size.deleted}`}</span>
  </span>
)

/**
 * One layer of the chain: what it is, what it is called, what state it is in.
 *
 * A row the reader is not standing on is a link, because every layer is a page
 * this extension draws — so `going.ts` answers the press without a document
 * while the address, the back button, a copied link and a middle click all keep
 * meaning what they say.
 */
const Layer = ({
  layer,
  tier,
  sitsOn,
  lands,
  holding,
  pressless,
  size
}: {
  readonly layer: StackLayer
  /** How far in this row steps from the first thing drawn, counted in gutters. */
  readonly tier: number
  /** Whether the thing this one sits on is drawn above it, and so whether to point at it. */
  readonly sitsOn: boolean
  /** Whether one press of merge on the layer being read takes this one with it. */
  readonly lands: boolean
  /** Whether this is a layer that cannot land, and so is stopping the press. */
  readonly holding: boolean
  /** Whether there is a press to answer about at all. There is not, on a proposal. */
  readonly pressless: boolean
  /** How many lines this layer changes, once somebody has counted them. */
  readonly size?: Size
}) => {
  const art = useArt()
  const What = art[pullRequestName(layer.state)]
  const StackedOn = art["stacked-on"]
  const badge = BADGE[layer.state]
  const here = layer.seat === "here"

  const inside = (
    <>
      <What
        size={12}
        aria-hidden="true"
        className={`shrink-0 ${
          holding
            ? "text-fail"
            : (TONE[layer.state] ??
              (pressless ? "text-ink-accent" : lands ? "text-pass" : "text-ink-muted"))
        }`}
      />
      <span className="shrink-0 font-mono tabular-nums text-ink-muted">
        {`#${layer.reference.number}`}
      </span>
      <span className={`min-w-0 truncate ${here ? "font-semibold text-ink" : ""}`}>
        {layer.title}
      </span>
      {/* The hold-up on the row that owns it, as far as one word goes. Grey says
          what a layer is; red says it is the one stopping the press, which is
          what the reader has to act on. */}
      {badge === undefined ? null : (
        <span
          className={`shrink-0 ${holding ? "font-semibold text-fail" : (TONE[layer.state] ?? "")}`}
        >
          {badge}
        </span>
      )}
      {/* Last on the row, after the one word about its state. The counts are the
          only thing here that arrives after the row does. */}
      {size === undefined ? null : <Lines size={size} />}
    </>
  )

  return (
    <li
      // `aria-current` rather than a word in the row: a reader being read to is
      // told which one they are on as they reach it, and a sighted reader has the
      // weight of the title and the step of the tier.
      aria-current={here ? true : undefined}
      style={steppedIn(tier)}
      className={lands || pressless ? "" : "opacity-60"}
    >
      {/* On every row whose own foundation is drawn above it, and on no other.
          The arm points at what a layer sits on, so a row with nothing above it
          would be pointing at whatever the window cut off, or at the branch row
          of the card. */}
      {sitsOn ? (
        <StackedOn size={12} aria-hidden="true" className="t-stack-mark shrink-0 text-ink-accent" />
      ) : null}
      {here ? (
        <span className={`${ROW} bg-hover`}>{inside}</span>
      ) : (
        <a href={pathTo(layer.reference)} className={`${ROW} text-ink no-underline hover:bg-hover`}>
          {inside}
        </a>
      )}
    </li>
  )
}

/**
 * What the window cut off, said rather than left as a chain that stops for no reason.
 *
 * "Earlier" and "later", not "below" and "above". The chain is drawn in the order
 * it lands, so a marker at the head is nearer the foundation and one at the foot
 * is nearer the top — and the seat words would then have "4 more below" standing
 * above everything it is counting.
 */
const Rest = ({
  howMany,
  which,
  tier
}: {
  readonly howMany: number
  readonly which: "earlier" | "later"
  /** In line with the row it stands next to, so it reads as part of the chain. */
  readonly tier: number
}) => (
  <li style={steppedIn(tier)} className="text-xs text-ink-muted">
    <span className="t-stack-row px-2 py-0.5 tabular-nums">
      {`${howMany} ${which} layer${howMany === 1 ? "" : "s"}`}
    </span>
  </li>
)

/**
 * The stack this pull request is one layer of, drawn where a reader arrives.
 *
 * Trunk at the top left, newest at the bottom right, each layer stepped in from
 * the one it sits on. The same way up as a pile in the Working Set, which is the
 * tree a reader of this interface already reads every day, and the same way up as
 * every other nesting they meet: a thing above and to the left, the things that
 * stand on it under it and stepped in. Two drawings of a stack running opposite
 * ways inside one interface is a reader having to hold which screen they are on
 * before they can read either.
 *
 * It also puts the chain in the order it lands, top to bottom, which is what lets
 * the count at a cut edge say "earlier" and "later" instead of a seat word that
 * would fight the screen.
 *
 * The trunk is a row of its own, and it is the cheapest thing here. A chain of
 * feature branches with an arrow on each row says which neighbour a layer sits
 * on and never says which way the whole thing is going; the one row holding
 * `main` settles it, and Gerrit has an eight-year-old request open for exactly
 * this because their panel leaves it out.
 *
 * What a press would land and what is holding it up are the merge card's
 * answers, further down the same column. This one answers where the reader is.
 */
export const StackTree = ({
  chain,
  most = ROOM,
  proposed = false,
  sizes
}: {
  readonly chain: Chain
  /** How many layers there is room to draw. The rest is counted at the edges. */
  readonly most?: number
  /**
   * How many lines each layer changes, by its number, as far as anybody knows.
   *
   * The proposal strip hands these over and the header does not, and that is the
   * one thing the two drawings of a chain differ on in what they say rather than
   * in how they say it.
   *
   * A reader on the strip is deciding about pull requests they have not opened.
   * One press stacks all of them, and from then on a merge on any one of them
   * lands the layers underneath, so how much work each layer is is part of what
   * is being agreed to — and there is nowhere else on the screen to get it. A
   * reader in the header is standing in a chain that exists, one layer at a
   * time: the well directly above this tree already counts the lines of the
   * layer they are on, and every other layer is a page this extension draws,
   * whose own header counts its lines when they get there.
   *
   * The cost settles it. Each count is a read of `page_data/diffstat` for one
   * pull request — seventy bytes, and the only route GitHub has that says how big
   * a pull request is without sending it — so one request per row. The strip is
   * drawn where GitHub offers a stack and nobody has made one, which is a state
   * that ends the moment somebody presses the button; this tree is drawn on every
   * layer of every stack, where GitHub's own preview feedback records chains of
   * twenty two. The same counts there would be ten more requests on a page that
   * costs five, on every visit, for numbers nobody asked for.
   *
   * Absent rather than empty where nobody is counting, though a row draws the
   * same either way: what a count does not arrive for is a row exactly as it was.
   */
  readonly sizes?: LayerSizes
  /**
   * Whether this chain is one GitHub offers to make rather than one it holds.
   *
   * Two things go: the green, and the dimming. Both of them are about a press —
   * green says one press of merge takes this layer with it, grey says it does
   * not — and there is no press to be had on a chain nobody has made. Painted
   * anyway they would answer a question the reader has not got to yet, and get
   * it wrong: nothing here lands.
   *
   * What arrives instead is the linking, because the rows are the claim rather
   * than a report. See `stack.css`.
   */
  readonly proposed?: boolean
}) => {
  const seat = whichLayer(chain)

  // A chain with no links in it. The merge card's panel declines for the same
  // reason, and git-spice posts its navigation comment only from two entries up.
  if (chain.layers.length < 2 || Option.isNone(seat)) return null

  const shown = aroundHere(chain, most)
  const lands = new Set(
    proposed ? [] : wouldLand(chain).map((layer) => layer.reference.number)
  )
  const holding = new Set(proposed ? [] : holdingItUp(chain).map((layer) => layer.reference.number))

  // The trunk is the root row of the tree and not a footnote under it, so it is
  // drawn first and the tiers are counted from it. Where the payload names one —
  // see `Stack.floor` — and where the window came all the way down to the
  // foundation, because this row says what the row under it sits on: over a
  // window cut short it would name a branch the first layer drawn does not go
  // into, and the count above it already says the chain carries on.
  const grounded = Option.isSome(chain.floor) && shown.under === 0
  const rows = [...(grounded ? [chain.floor.value] : []), ...shown.layers]

  return (
    <ol
      // Named with the count, so the one fact the shape carries is also a fact
      // for a reader who is being read to rather than looking. The whole stack,
      // not the part that fitted: being on layer 7 of 12 is the situation, and
      // the window is this interface's problem.
      // The word "stack" only where the surroundings do not already say it. A
      // chain nobody has made is drawn in one place, inside a region named
      // "Proposed stack", and a list repeating those two words is the same name
      // announced twice on the way in. A stack that exists is inside the header
      // card, which is named for the pull request rather than for the chain.
      aria-label={
        proposed
          ? `Layer ${seat.value.at} of ${seat.value.of}`
          : `Stack, layer ${seat.value.at} of ${seat.value.of}`
      }
      className={`t-stack-up mt-1 flex flex-col gap-0.5 ${proposed ? "t-stack-linking" : ""}`}
    >
      {/* The count of what the window cut off nearer the foundation stands above
          the rows, which is the end of the chain that is up here. */}
      {shown.under === 0 ? null : <Rest howMany={shown.under} which="earlier" tier={0} />}
      {/* Foundation first out of the domain and foundation first down the screen,
          so nothing turns over on the way here. */}
      {rows.map((row, tier) =>
        typeof row === "string" ? (
          <li key="floor" style={steppedIn(tier)}>
            <span className="t-stack-row flex items-center px-2 py-0.5">
              <span className={`${CHIP} font-mono text-xs text-ink`}>{row}</span>
            </span>
          </li>
        ) : (
          <Layer
            key={row.reference.number}
            layer={row}
            tier={tier}
            // Nothing above the first row drawn, whether that is the trunk, the
            // foundation, or wherever the window cut the chain.
            sitsOn={tier > 0}
            lands={lands.has(row.reference.number)}
            holding={holding.has(row.reference.number)}
            pressless={proposed}
            size={sizes?.get(row.reference.number)}
          />
        )
      )}
      {/* And what it cut off nearer the top stands under them, stepped in with
          the last row drawn so the chain reads as carrying on rather than as a
          note about the list. */}
      {shown.over === 0 ? null : <Rest howMany={shown.over} which="later" tier={rows.length} />}
    </ol>
  )
}
