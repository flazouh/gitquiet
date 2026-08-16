import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Toaster, toast } from "sonner"
import { OVER_ID, outsideHost } from "./outside"
import { SettledIcon } from "./settled"

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

/**
 * Sentences asked for before the surface that shows them was on the page.
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
 */
const queued: Array<() => void> = []
let standing = false
let wake: (() => void) | undefined

/** Says it now, or as soon as there is somewhere to say it. */
const whenStanding = (say: () => void): void => {
  if (standing) {
    say()
    return
  }
  queued.push(say)
  wake?.()
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
    wake = () => setNeeded(true)
    return () => {
      wake = undefined
    }
  }, [])

  useEffect(() => {
    if (!needed) return
    standing = true
    // In the order they were asked for, which `freshening` depends on: the
    // spinner has to exist before the verdict can be written over it.
    for (const say of queued.splice(0)) say()
    return () => {
      standing = false
    }
  }, [needed])

  // From render, which `outsideHost` is built for: idempotent, so the second Toasts in a nested
  // shell would get the same host rather than a second one.
  const host = typeof document === "undefined" || !needed ? null : outsideHost(document, OVER_ID)
  if (!needed) return null
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

/** What the interface says when the read agreed with what was already on screen. */
export const UP_TO_DATE = "Up to date"

/**
 * How long the answer stands.
 *
 * Long enough to be seen and not long enough to be in the way. The check takes about 400ms to
 * draw, so anything under a second would be a mark that is still arriving as it leaves.
 */
export const SETTLED = 1600

/** A read in progress, and the two ways it can end. */
export type Freshening = {
  /**
   * GitHub answered. The same toast says so and then goes on its own.
   *
   * The same toast, by id: a second one under the first would be two sentences about one read,
   * and the reader watched the first one spin.
   */
  readonly landed: () => void
  /**
   * Down with no verdict, because there is none: the screen went away or the sentence changed.
   *
   * Distinct from {@link Freshening.landed} on purpose. "Up to date" about a read that was
   * abandoned is a claim the reader would act on.
   */
  readonly take: () => void
}

/**
 * What you are reading is a moment old, and the newest is on its way.
 *
 * The third sentence this file can say, and the first that is about a read
 * rather than a write. Every list here shows what it remembers the instant it
 * opens, which is the whole reason the interface feels immediate — and it is
 * also a small lie, because the reader is looking at the last answer and
 * deciding what to do from it.
 *
 * Stays up until the read lands rather than for a few seconds, because it is not
 * an announcement: it is the state of one thing, and the thing it describes ends
 * at a moment this can be told about. Hands back both endings, so a caller can
 * neither forget which toast was theirs nor take down somebody else's.
 *
 * And it answers itself, which it did not use to. A spinner that is dismissed on landing is a
 * thing that spun at the top of the screen and then was not there, and a reader cannot tell that
 * from a read that gave up — least of all when the list underneath does not change, which is what
 * happens every time GitHub agrees with what was already shown. The word and the drawn check are
 * the end of the sentence the spinner started.
 */
export const freshening = (said: string): Freshening => {
  // Written by the queued call above rather than returned from it, because the
  // spinner may not have been raised yet: see `whenStanding`. Both endings are
  // queued behind it, so by the time either runs the id is the one it names.
  let which: string | number | undefined
  whenStanding(() => {
    which = toast.loading(said, { duration: Infinity })
  })

  return {
    landed: () => {
      whenStanding(() =>
        toast.success(UP_TO_DATE, {
          id: which,
          duration: SETTLED,
          // The tone comes from `LOOK.success`, which is where every icon in this file gets
          // its colour. Said twice would be two places to change it.
          icon: <SettledIcon size={14} />
        })
      )
    },
    take: () => whenStanding(() => toast.dismiss(which))
  }
}
