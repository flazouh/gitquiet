import { Option } from "effect"
import type { PullRequestState, Stack, StackLayer } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { holdingItUp, wouldLand } from "../domain/pressing"
import { pullRequestName, useArt } from "./art"
import { CHIP } from "./dress"

/**
 * What each layer's state is worth saying beside it.
 *
 * Only where it is not the ordinary case. Three rows all wearing "Open" is three
 * words that distinguish nothing, and the one row saying "Draft" is the only one
 * anybody has to act on.
 */
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

/** A list of numbers said the way it would be read out: one, two, or three and more. */
const spoken = (numbers: ReadonlyArray<number>): string => {
  const said = numbers.map((number) => `#${number}`)
  if (said.length < 2) return said.join("")

  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`
}

/**
 * One layer, as a row: what it is called, what state it is in, its number.
 *
 * A row the reader is not standing on is a link, not a button, and that is the
 * whole of the navigation here. Every layer is a page this extension draws, so
 * `going.ts` catches the press and puts the screen up without a document — while
 * the address, the back button, a copied link and a middle click all keep
 * meaning what they say, which is what a handler on a `div` would have thrown
 * away.
 *
 * The fill is on the row and the padding is on the link inside it, which is how
 * every other list in this interface is built: the whole width lights under the
 * pointer rather than the strip the text happens to occupy.
 */
const Layer = ({
  layer,
  lands,
  holding
}: {
  readonly layer: StackLayer
  /** Whether one press of merge takes this layer with it. */
  readonly lands: boolean
  /** Whether this is one of the layers that cannot land, which stops the press. */
  readonly holding: boolean
}) => {
  const art = useArt()
  const What = art[pullRequestName(layer.state)]
  const badge = BADGE[layer.state]
  const here = layer.seat === "here"

  const inside = (
    <>
      <What
        size={12}
        aria-hidden="true"
        className={`shrink-0 ${
          holding ? "text-fail" : (TONE[layer.state] ?? (lands ? "text-pass" : "text-ink-muted"))
        }`}
      />
      {/* Before the title, as it is in the header's own heading, in the Working
          Set's rows and in the tree at the top of this screen. It rode at the end
          of the row, which made this the one place in the interface where the
          fact that names a pull request was not the first thing on its line. */}
      <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
        {`#${layer.reference.number}`}
      </span>
      <span className={`min-w-0 flex-1 truncate ${here ? "font-semibold text-ink" : ""}`}>
        {layer.title}
      </span>
      {/* The reason on the row that owns it, as far as one word goes. A grey
          "Draft" beside a title says what that layer is; the same word in red
          says it is the one holding this press up, which is the thing the
          reader has to act on and the thing GitHub's own card never says. */}
      {badge === undefined ? null : (
        <span
          className={`shrink-0 text-xs ${holding ? "font-semibold text-fail" : (TONE[layer.state] ?? "")}`}
        >
          {badge}
        </span>
      )}
    </>
  )

  return (
    <li
      // `aria-current` rather than a word in the row. A reader being read to is
      // told which one they are on when they reach it, and a sighted reader has
      // the weight of the title; a row that spelled it out would say it again on
      // every pass down the list.
      aria-current={here ? true : undefined}
      className={`${here ? "bg-hover" : "hover:bg-hover"}${lands ? "" : " opacity-60"}`}
    >
      {here ? (
        <span className="flex items-center gap-2 px-3 py-1.5 text-xs">{inside}</span>
      ) : (
        <a
          href={pathTo(layer.reference)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink no-underline"
        >
          {inside}
        </a>
      )}
    </li>
  )
}

/**
 * What one press lands, in the words the rest of this card uses for it.
 *
 * "all 2" is not something anybody says, and a stack of two is the commonest
 * stack there is.
 */
const landsWhat = (landing: number, of: number): string => {
  if (landing < of) return `This press lands ${landing} of ${of} layers`

  return of === 2 ? "This press lands both layers" : `This press lands all ${of} layers`
}

/**
 * The stack, drawn where the press that lands it is.
 *
 * Trunk first, then the foundation, then everything standing on it, which is the
 * way up the Working Set draws a pile and the way up the tree at the top of this
 * screen draws the same chain. Two drawings of one stack running opposite ways on
 * one screen is a reader having to notice the disagreement before reading either.
 *
 * The trunk leads rather than trails for the same reason. It is the row the whole
 * chain goes into, so it reads as what the layers under it land on — trailing, it
 * read as a footnote about the list.
 *
 * The sentence at the top is the reason this panel exists at all. A merge card
 * on a layer of a stack names one pull request and lands several, and nothing
 * else on the screen says how many — GitHub's answer about mergeability is about
 * the one being read, which is not the thing that is about to happen.
 */
export const TheStack = ({ stack }: { readonly stack: Stack }) => {
  const art = useArt()
  const Err = art.error

  // A stack of one is a stack GitHub keeps and lands through the stack route,
  // and it is still nothing to draw: one row over one sentence saying the press
  // lands that row is the card above it, repeated. git-spice reaches the same
  // rule from the other side, posting its navigation comment only from two.
  if (stack.layers.length < 2) return null

  const landing = wouldLand(stack)
  const held = holdingItUp(stack)
  const above = stack.layers.filter((layer) => layer.seat === "above").length
  const lands = new Set(landing.map((layer) => layer.reference.number))
  const holding = new Set(held.map((layer) => layer.reference.number))

  return (
    <div className="border-b border-line-muted">
      <p className="flex flex-wrap items-baseline gap-x-1.5 px-3 py-2 text-xs leading-snug">
        <span className="font-semibold text-ink tabular-nums">
          {landsWhat(landing.length, stack.layers.length)}
        </span>
        {above > 0 ? (
          <span className="text-ink-muted tabular-nums">
            {above === 1 ? "1 above stays open" : `${above} above stay open`}
          </span>
        ) : null}
      </p>
      {/* The floor, where the payload gives one, at the head of the chain that
          goes into it. Without it the first row reads as the start of something
          rather than as a layer sitting on a branch — and with the wrong branch
          in it, it would say the whole stack lands on another layer of itself.
          See `Stack.floor`.

          Dressed as a branch is dressed in the header, because it is the same
          kind of thing said in a different place.

          A word and not the stacked-on mark. The mark says "this row sits on
          that one" and belongs on the row doing the sitting, which is every row
          under this one; this list has no gutter to hang it in, so on the trunk's
          own row it pointed at the wrong thing. One word says it and cannot be
          read backwards. */}
      {Option.isSome(stack.floor) ? (
        <p className="flex items-center gap-2 border-t border-line-muted px-3 py-1.5 text-xs text-ink-muted">
          onto
          <span className={`${CHIP} font-mono text-xs text-ink`}>{stack.floor.value}</span>
        </p>
      ) : null}
      <ul className="divide-y divide-line-muted border-t border-line-muted">
        {stack.layers.map((layer) => (
          <Layer
            key={layer.reference.number}
            layer={layer}
            lands={lands.has(layer.reference.number)}
            holding={holding.has(layer.reference.number)}
          />
        ))}
      </ul>
      {held.length === 0 ? null : (
        // Named, not left to a grey button, and shaped like every other blocker
        // on this card: the fact on one line and what to do about it under.
        // This is the one GitHub's merge state does not carry, because it
        // answers about the layer being read and the layer being read is not
        // the whole of what the press lands.
        <div className="flex items-start gap-2 border-t border-line-muted px-3 py-2">
          <Err size={12} className="mt-1 shrink-0 text-fail" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold">
              {held.length === 1
                ? `${spoken(held.map((layer) => layer.reference.number))} is a draft`
                : `${spoken(held.map((layer) => layer.reference.number))} are drafts`}
            </span>
            <span className="text-xs leading-snug text-ink-muted">
              {held.length === 1
                ? "It lands with this press, and a draft cannot land. Mark it ready first."
                : "They land with this press, and a draft cannot land. Mark them ready first."}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
