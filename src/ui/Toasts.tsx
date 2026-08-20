import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Toaster, toast } from "sonner"
import { OVER_ID, outsideHost } from "./outside"

/**
 * What the interface says when the thing it showed you turns out to be wrong.
 *
 * An optimistic list needs somewhere to put a refusal. The row moved the moment
 * it was asked for, GitHub said no a second later, and the row moved back — and
 * without a sentence, that is a list that shuffled itself for reasons nobody was
 * told. The control that asked is usually gone by then: the menu closed on the
 * press, which is the point of showing the change immediately.
 *
 * Bottom right, which is where it ended up rather than where it started.
 *
 * The top middle was chosen on the argument that it is the one place belonging to nobody else
 * and the place a reader's eyes already are. The second half of that turned out to be the
 * problem: a reader's eyes are at the top of the list because that is where they are working,
 * and a sentence printed over the row they are pointing at interrupts the thing it is reporting
 * on. It also put the toast under our own bar, which is a strip at the top centre of every page
 * this extension takes over.
 *
 * The corner is out of the way of both and still in view. Right rather than left because the
 * Rail is on the left in both shells, and bottom because a list grows downwards: the newest row
 * is never the one a toast covers.
 */

/**
 * Every toast wears the card's own dress, in both shells' tokens.
 *
 * A fill and a shadow, no edge. A toast is the one thing here that genuinely floats
 * over the page, and a shadow is the only mark that says how far off it is; the line
 * around it was the third thing saying what the fill and the shadow already said.
 */
const LOOK = {
  /*
   * `border-0` is stated rather than left out, which is the whole of the bug it fixes.
   *
   * Sonner dresses `[data-sonner-toast][data-styled=true]` with `border: 1px solid
   * var(--normal-border)`, and at `theme="light"` that resolves to `#ededed`. Measured on a
   * pull request page: a raised dark panel with a near-white line around it. Taking our own
   * `border-line` off — which is what the borderless pass did — left their rule unopposed, the
   * same way the keycaps kept Primer's edge by saying nothing about it.
   *
   * The `!` is not decoration here: two attribute selectors outweigh a class, so a plain
   * `border-0` loses to that rule. Every other name in this table carries one for the same
   * reason.
   */
  toast:
    "!w-auto !gap-2 !rounded-md !border-0 !bg-raised !px-3 !py-2 !font-sans !text-xs !text-ink !shadow-pop",
  title: "!font-semibold",
  description: "!text-ink-muted",
  // Only the icon carries the tone. A whole panel filled red for "GitHub would
  // not reopen this" is louder than the fact, and the fact has already been
  // shown by the row moving back to where it was.
  error: "[&>[data-icon]]:!text-fail",
  success: "[&>[data-icon]]:!text-pass",
  // Quieter than either. Nothing has gone right or wrong; something is being
  // read, and the reader is already looking at the last answer to it.
  loading: "[&>[data-icon]]:!text-ink-muted",
  icon: "!m-0 !size-3.5 !shrink-0",
  // The way back, dressed as the quiet button it is: the reader is being offered a
  // way out of something that went right, and a toast whose loudest thing is the
  // undo reads as a warning about the verb they just chose on purpose. A tint is as
  // quiet as a control gets while still being one.
  actionButton:
    "!ml-1 !rounded-md !bg-hover !px-1.5 !py-0.5 !font-sans !text-xs !font-semibold !text-ink hover:!bg-active"
} as const

/**
 * Whether a tree above this one is already showing toasts.
 *
 * Both shells put this in `Supplied`, and `Supplied` nests: the window wraps
 * both screens and each screen wraps itself again, so a document that should
 * have one Toaster had three, stacked exactly on top of each other — every
 * refusal drawn three times, in the same place, at the same weight. Invisible
 * to look at and wrong in every other way, so the provider counts rather than
 * trusting whoever mounted it to have been the only one.
 */
const Standing = createContext(false)

export const Toasts = ({ children }: { readonly children?: ReactNode }) => {
  const already = useContext(Standing)

  return (
    <Standing.Provider value={true}>
      {children}
      {already ? null : <Stand />}
    </Standing.Provider>
  )
}

/*
 * Sentences asked for before the surface that shows them was on the page, the
 * screens that could raise one, and how many have.
 *
 * A section rather than three doc comments, because no one of these three names
 * means anything without the other two.
 *
 * Sonner's `Toaster` is not free to mount. It reads the document's writing
 * direction, which is `getComputedStyle` on the root of GitHub's page, and it
 * flushes React synchronously to measure the toasts it is holding. Measured on a
 * press between two pull requests: 94ms in `getDocumentDirection` and 123ms in
 * the flush, on every screen this extension stands up — for a corner of the
 * screen that is empty on all but a handful of them.
 *
 * So it is mounted when there is something to say and not before. A screen that
 * never refuses anything never pays for it, and a screen that does pays once,
 * after the press it is reporting on rather than during it.
 *
 * Counted and held by identity, for the same reason `Standing` above counts. Two
 * screens are on the page at once at every navigation, on purpose: `screen.tsx`
 * takes the outgoing root down from `whenAnotherBarStands`, up to `HANDOVER`
 * after the incoming one has already mounted. A single slot and a single flag are
 * written by whichever screen ran last and cleared by whichever screen leaves
 * first, and those are not the same screen. The leaving one took the surface away
 * from the one still standing, and the extension went mute for the rest of the
 * document: press a pull request from a list, press back, and no refusal, no way
 * back and no read in progress was ever said again.
 *
 * A set and a count are right under any overlap and any order of leaving. A slot
 * and a flag are right under neither.
 */
const queued: Array<() => void> = []
const waking = new Set<() => void>()
let stands = 0

/** Says it now, or as soon as there is somewhere to say it. */
const whenStanding = (say: () => void): void => {
  if (stands > 0) {
    say()
    return
  }
  queued.push(say)
  for (const wake of waking) wake()
}

/**
 * Where the toasts are hung, which is not where this component is mounted.
 *
 * Sonner asks for `z-index: 999999999` and was still losing. GitHub wraps their whole page in
 * `div.logged-in`, which carries `isolation: isolate` — a stacking context — so every z-index
 * inside it is sorted against its siblings and then the whole context is placed as one thing.
 * Our root is in there. The bar is not: it is a `position: sticky` slot in `document.body` at
 * `z-index: 30`, and thirty in the body's context beats a billion trapped in theirs. Measured
 * on Home: the toast drew behind the glass.
 *
 * So the toaster joins the bar and the hover cards in `outside.ts`, which exists for exactly
 * this — "the elements of ours that cannot live inside our root". The host is marked, so the
 * stylesheet's resets and the theme's repaint find it without being told.
 *
 * The window needs none of this and is unharmed by it: `document.body` there is ours, and a
 * fixed layer at the end of it is where a toast belongs anyway.
 */
const Stand = () => {
  const [needed, setNeeded] = useState(() => queued.length > 0)

  useEffect(() => {
    const wake = () => setNeeded(true)
    waking.add(wake)
    // Asked for between this component rendering and this effect running, which is a
    // window nothing else closes.
    if (queued.length > 0) wake()
    return () => {
      waking.delete(wake)
      // Nothing of ours is on the page any more, so a sentence still waiting for
      // somewhere to be said is about a screen the reader has left. Said late, it would
      // be a claim about the wrong page.
      if (waking.size === 0) queued.length = 0
    }
  }, [])

  useEffect(() => {
    if (!needed) return
    stands += 1
    /*
     * In the order they were asked for, which `freshening` depends on: the spinner has
     * to exist before the verdict can be written over it.
     *
     * And after the Toaster below is listening, which is what makes this the right
     * effect rather than the render. Sonner publishes to an observer and drops anything
     * said before its own subscribe; that subscribe is a child effect of this one, and
     * React runs children first.
     */
    for (const say of queued.splice(0)) say()
    return () => {
      stands -= 1
    }
  }, [needed])

  // From render, which `outsideHost` is built for: idempotent, so the second Toasts in a nested
  // shell would get the same host rather than a second one.
  if (!needed) return null
  const host = typeof document === "undefined" ? null : outsideHost(document, OVER_ID)
  const stand = (
    <Toaster
      position="bottom-right"
      // Ours, not theirs: `richColors` fills the whole panel in a palette that is
      // neither GitHub's nor the app's, and the tokens below already follow the
      // reader's theme into dark, dimmed and high contrast.
      richColors={false}
      // Off. It reads the document's own colour scheme, and in the extension the
      // document is GitHub's page — where the toast is meant to look like the rest
      // of this interface rather than like the page it is standing on.
      theme="light"
      gap={8}
      /*
       * Twelve from the corner it sits in. On GitHub's page `glass.css` takes this to the same
       * gutter the bar and the columns are inset by, so the toast lines up with the right edge
       * of the interface rather than floating at its own distance — in CSS rather than here,
       * because the inset is a fact about the place and this component is in both shells.
       */
      offset={12}
      visibleToasts={3}
      toastOptions={{ classNames: LOOK }}
    />
  )

  return host === null ? stand : createPortal(stand, host)
}

/**
 * GitHub said no.
 *
 * The row moved back to where it was, and this is the sentence saying why. The
 * control that asked is usually gone by then, which is what the toast is for.
 */
export const refused = (said: string): void => {
  whenStanding(() => toast.error(said))
}

/**
 * A way out of something that has already happened.
 *
 * `said` is what the button says, which is nearly always "Undo"; `go` is the
 * asking of whatever puts it back. Not an effect, because the caller is the one
 * holding the gateway and this module has never known what a gateway is.
 */
export type WayBack = {
  readonly said: string
  readonly go: () => void
}

/**
 * How long a way back is worth offering.
 *
 * Sonner's own four seconds is right for a sentence: read it, forget it. It is
 * short for a button, which has to be noticed, understood as an offer, and
 * reached for with a pointer — and a reader who has just merged something is
 * looking at the row that moved, not at the top of the window. Ten seconds, and
 * hovering the toast stops the clock, which Sonner does on its own.
 */
const LONG_ENOUGH_TO_UNDO = 10_000

/**
 * The interface did the thing, and here is the way back out of it.
 *
 * The other half of {@link refused}, and the reason this file is no longer only
 * about refusals. A list that rearranges itself the moment it is asked to has
 * told the reader that something happened but not what: the row they were
 * pointing at is in another Court, or gone from the filter altogether, and the
 * menu that did it closed on the press. So the verb says its own name in the
 * past tense, and where GitHub will undo it, the sentence carries the undoing.
 *
 * Which is what buys the single press. Asking twice before a verb and offering a
 * way back after it are answers to the same question, and a surface that does
 * both is charging the reader twice for one mistake.
 */
export const done = (said: string, back?: WayBack): void => {
  whenStanding(() =>
    toast.success(said, {
      duration: back === undefined ? undefined : LONG_ENOUGH_TO_UNDO,
      action: back === undefined ? undefined : { label: back.said, onClick: back.go }
    })
  )
}

/**
 * Known content changed when GitHub answered a background read.
 *
 * Neutral rather than successful: nothing was asked for and nothing completed. The useful
 * fact is only that the content the reader was already looking at is different now.
 */
export const updated = (said: string): void => {
  whenStanding(() => toast(said))
}
