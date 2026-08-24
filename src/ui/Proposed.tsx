import { Effect } from "effect"
import { useEffect, useRef, useState } from "react"
import type { Chain } from "../domain/PullRequest"
import { aroundHere } from "../domain/pressing"
import type { Size } from "../domain/workingSet"
import { useArt } from "./art"
import { reasonFor } from "./refusal"
import { Says } from "./says"
import { ROOM, StackTree } from "./StackTree"
import { type AskLayerSizes, type LayerSizes, useLayerSizes } from "./useLayerSizes"

/**
 * Where the press has got to, which is a state the strip has to hold.
 *
 * A write that has been asked for and not answered is the interesting one. The
 * request takes as long as GitHub takes, the rows on the screen are still a
 * description of something that does not exist, and a button that has not moved
 * is a button somebody presses again.
 *
 * `made` is not the end of it either, and that is why it is here rather than
 * left to the strip disappearing. GitHub answers before the read that follows
 * does, and for that second the strip is standing over a stack that exists.
 */
type Making =
  | { readonly step: "idle" }
  | { readonly step: "working" }
  | { readonly step: "made" }
  | { readonly step: "refused"; readonly said: string }

/**
 * The one sentence the strip says about itself, in the state it is in.
 *
 * Every state has one, including the resting one, because this line is a live
 * region: a region that is empty until something happens is a region an
 * assistive technology has nothing to attach the change to, and the reader who
 * pressed the button hears nothing back.
 *
 * None of them counts the pull requests or names the branch. Both facts are on
 * the rows directly underneath — the rows are the count, and the trunk row is
 * the branch — and a sentence repeating either is one fact read twice on one
 * screen.
 */
const sentenceFor = (making: Making): string => {
  if (making.step === "working") return "Making the stack."
  if (making.step === "made") return "These pull requests stack now."
  if (making.step === "refused") return making.said
  return "These pull requests can stack."
}

/**
 * What the one button on the strip says, at rest and while GitHub is being asked.
 *
 * It said "Make the stack" throughout, on the grounds that the sentence beside it
 * already reports the press and that a button rewriting itself mid-press moves the
 * target under the pointer. The first half is still true and the second was the
 * wrong way round: the button that kept its word is the one that changed size,
 * because the circle was added to a box already cut for the word alone. Both words
 * stand in one cell now — see {@link Says} — so the box is the width of the wider
 * of them before a press and during one, and the wait rides with the word that
 * only exists while there is a wait.
 *
 * Which leaves the sentence saying "Making the stack." beside a button saying
 * "Making…", and that is the right redundancy to keep: the sentence is a live
 * region for a reader who is not looking at the strip, and the button is what the
 * reader who is has their hand on.
 */
const WORDS = ["Make the stack", "Making…"] as const

const TONE: Record<Making["step"], string> = {
  idle: "text-ink",
  working: "text-ink",
  made: "text-pass",
  refused: "text-fail"
}

/**
 * Which proposal this is, as far as anything held about one is concerned.
 *
 * The layers and nothing else. A proposal with other pull requests in it is
 * another proposal, and what was said about the last one — that GitHub refused
 * it, that it was made — is not true of this one.
 */
const whichOne = (chain: Chain): string =>
  chain.layers.map((layer) => layer.reference.number).join(",")

/**
 * The stack this pull request could be a layer of, drawn where GitHub's offer was.
 *
 * GitHub puts a blue banner across the top of a pull request whose branch sits on
 * another open pull request's branch: "This pull request can be stacked with other
 * pull requests", a link to the documentation, and a Preview stack button. The
 * banner is right about the situation and says almost nothing about it. It names
 * no pull request, no branch and no number of them, so the one question a reader
 * arriving at it has — which ones, and in what order — costs a press of a button
 * and a dialog over the page they came to read.
 *
 * This is that dialog's content, in the banner's place, without the press. What
 * GitHub's preview is, we already draw: the chain that would exist, layer by
 * layer, over the branch it would land on — {@link StackTree}, whose rows are a
 * claim about what would link up rather than a report on a press, because there
 * is no press to be had on a chain nobody has made.
 *
 * Above the header and not inside it, which is where GitHub's own banner stands
 * and the one place it belongs. The header answers what this pull request is; the
 * strip's subject is the other pull requests, and a chain nobody has made cannot
 * sit under the row saying which layer of it the reader is on, because they are
 * not on a layer of anything yet.
 *
 * The one button on it makes the stack, and it is the press GitHub keeps behind
 * their dialog. Theirs costs two: the first opens the preview, the second agrees
 * to what is in it. The preview is here already, so only the second press is
 * left, and a reader reaching for it has the rows they are agreeing to under
 * their eyes rather than in a panel over the page they came to read.
 *
 * It asks once, where the merge card asks twice. Merging and closing end the
 * reading, and that is what the second press there is for; this ends nothing.
 * GitHub keeps every pull request exactly where it was, each one still opens on
 * its own page, and what changes is that a press of merge on any of them lands
 * the layers underneath as well. The rows under the button say which. What the
 * strip cannot offer is a way back out — undoing a stack is on GitHub's own page
 * — which is why the sentence and the rows are doing the work a second press
 * would otherwise do.
 *
 * Nothing here draws the stack it made. The subject of the strip is a chain
 * nobody has made, so the moment one exists it has nothing left to say: the read
 * that follows the press comes back with no proposal and a stack on the merge
 * state, and the header's own tree takes the chain over. Between the two —
 * GitHub has answered, the read has not landed — it says the pull requests stack
 * and stops offering to make them, because a strip still reading "These pull
 * requests can stack" over a stack that exists is the one thing it must not say.
 *
 * Keyed on the chain, so what is held about a press cannot outlive the pull
 * requests it was about. The strip stands for as long as the reader reads, a
 * re-read can arrive with other pull requests in the proposal, and a refusal
 * kept across that would be GitHub's sentence about a pair that is gone,
 * standing beside rows it was never about.
 */
export const Proposed = ({
  chain,
  make,
  sizes,
  own
}: {
  readonly chain: Chain
  /**
   * Makes the chain into a stack, and fails with whatever GitHub said instead.
   *
   * Absent where nobody wired one, which is every surface that reads a pull
   * request through something with no such write in it. A button that cannot do
   * what it says is worse than no button, so there is none.
   */
  readonly make?: () => Effect.Effect<void, unknown>
  /**
   * Counts the lines of the other layers, saying each as GitHub answers for it.
   *
   * Absent where nobody wired it, like the press above, and the rows are then the
   * rows without their counts. Nothing here waits for it: the strip is drawn on
   * the frame the pull request is, and the counts land on the rows afterwards.
   */
  readonly sizes?: AskLayerSizes
  /**
   * How big the pull request being read is, which the snapshot already counted.
   *
   * Handed over rather than asked for, so the layer the reader is standing on
   * costs nothing: the read that drew this strip carries every changed file of
   * it. It is on the row all the same, because a count is only worth having next
   * to the other counts — a strip saying the layer underneath is nine hundred
   * lines and leaving the reader's own layer blank is asking them to hold one of
   * the two numbers in their head.
   */
  readonly own?: Size
}) => {
  // A chain of one is what GitHub answers `null` for, and it is nothing to draw
  // either way: one row over a sentence about one pull request is the header,
  // repeated. Both existing drawings of a chain decline at the same count.
  if (chain.layers.length < 2) return null

  return <Offer key={whichOne(chain)} chain={chain} make={make} sizes={sizes} own={own} />
}

/**
 * The rows this strip will draw, which are the only rows worth counting.
 *
 * A count is a request each, and the window the tree draws is five rows: a
 * proposal deeper than that has layers nobody will see, and asking GitHub how
 * big they are buys a number that goes nowhere. Same window and same limit, from
 * the same function the tree cuts with.
 *
 * Less the layer being read, whose lines arrive with the pull request.
 */
const worthCounting = (chain: Chain) =>
  aroundHere(chain, ROOM).layers.filter((layer) => layer.seat !== "here")

/** What is known about the layers on the screen: what was counted, and the reader's own. */
const asFarAsKnown = (
  chain: Chain,
  counted: LayerSizes,
  own?: Size
): LayerSizes | undefined => {
  const here = chain.layers.find((layer) => layer.seat === "here")
  if (own === undefined || here === undefined) return counted

  return new Map(counted).set(here.reference.number, own)
}

const Offer = ({
  chain,
  make,
  sizes,
  own
}: {
  readonly chain: Chain
  readonly make?: () => Effect.Effect<void, unknown>
  readonly sizes?: AskLayerSizes
  readonly own?: Size
}) => {
  const [making, setMaking] = useState<Making>({ step: "idle" })
  const [handBack, setHandBack] = useState(false)
  const card = useRef<HTMLElement>(null)
  const press = useRef<HTMLButtonElement>(null)
  const art = useArt()
  const Err = art.error
  const counted = useLayerSizes(worthCounting(chain), sizes)

  const made = making.step === "made"
  const working = making.step === "working"

  /** Whether the reader is standing on the button that is about to go. */
  const onThePress = () => {
    const node = press.current
    if (node === null) return false

    // The root rather than the document: every screen of this extension is
    // drawn inside a shadow tree, where the document's own answer is the host.
    const holder = node.getRootNode() as Document | ShadowRoot
    return holder.activeElement === node
  }

  useEffect(() => {
    if (!handBack) return

    card.current?.focus()
    setHandBack(false)
  }, [handBack])

  const ask = () => {
    // A press while GitHub is answering, and a press on a stack that now
    // exists, are both the button doing what its own state says it will not.
    // Reached by a keyboard and by a second window either way, so the answer is
    // here rather than only in the attribute.
    if (make === undefined || working || made) return

    setMaking({ step: "working" })
    Effect.runFork(
      make().pipe(
        Effect.map(() => {
          setHandBack(onThePress())
          setMaking({ step: "made" })
        }),
        Effect.catch((cause) =>
          Effect.sync(() => setMaking({ step: "refused", said: reasonFor(cause) }))
        )
      )
    )
  }

  return (
    <section
      ref={card}
      // Named rather than left as a `div`, so a reader working through the
      // landmarks of the page can pass it: it is a suggestion about other pull
      // requests, above the pull request they came for.
      aria-label="Proposed stack"
      // Somewhere for the reader to be when the button goes. The press is the
      // only thing on the strip they can stand on, and it unmounts on the
      // answer, which puts them at the top of the document two cards above the
      // sentence saying what happened.
      tabIndex={-1}
      // No border: `quiet.css` takes the border off every named section on this
      // page, so the class the header card carries has never drawn a line here
      // or anywhere else. What separates this strip from the header card
      // directly beneath it is the fill that file gives `.t-proposed` and the
      // wider gap under it — nothing else on the column stands this far apart.
      className="t-proposed t-panel-fade mb-3 shrink-0 rounded-md p-2.5"
    >
      {/* The sentence and the press on one row, which is the row GitHub puts
          their own Preview stack button on. It also takes a whole row off the
          strip: the press used to stand under the rows, where it made the card
          half again as tall as the three lines of content on it. */}
      <div className="flex items-start gap-2">
        <p
          // The one part of the strip that answers a press, so it is the one
          // part that has to be read out when it changes. Everything the press
          // does is written here: that GitHub is being asked, that the pull
          // requests stack, and what GitHub said when it would not.
          role="status"
          className={`flex min-w-0 flex-1 items-start gap-1.5 text-xs font-semibold leading-snug ${TONE[making.step]}`}
        >
          {/* GitHub's own sentence, on the strip that asked for it rather than
              in a toast. A toast exists here for the writes whose control is
              gone by the time the answer arrives — a row's menu closes on the
              press — and this one is still on the screen with the reader's
              pointer on it. The refusals worth reading are theirs: the pull
              requests moved, or this reader may not write to the repository. */}
          {making.step === "refused" ? (
            <span aria-hidden="true" className="flex">
              <Err size={12} className="mt-0.5 shrink-0" />
            </span>
          ) : null}
          {sentenceFor(making)}
        </p>
        {make === undefined || made ? null : (
          <button
            ref={press}
            type="button"
            // Marked rather than disabled. `disabled` on the focused button
            // drops the reader onto the document, and the sentence saying what
            // they pressed is then on a strip they are no longer standing in.
            // The press itself already refuses a second run, so nothing is let
            // through by leaving the button reachable.
            aria-disabled={working ? true : undefined}
            // Said as well as drawn, for the reader who is being told what the
            // control they are standing on is doing rather than shown it.
            aria-busy={working ? true : undefined}
            onClick={ask}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent-emphasis px-2 py-1 text-xs font-semibold text-ink-on-emphasis hover:opacity-90 aria-disabled:opacity-60"
          >
            <Says among={WORDS} said={working ? WORDS[1] : WORDS[0]} waiting={WORDS[1]} />
          </button>
        )}
      </div>
      <StackTree
        chain={chain}
        sizes={sizes === undefined && own === undefined ? undefined : asFarAsKnown(chain, counted, own)}
      />
    </section>
  )
}
