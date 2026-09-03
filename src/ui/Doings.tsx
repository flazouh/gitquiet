import * as Menu from "@radix-ui/react-dropdown-menu"
import { Effect, Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { putsBack, type RowDoing, whatStateAllows } from "../domain/doable"
import type { InvolvedPullRequest } from "../domain/workingSet"
import { type Set, useArt } from "./art"
import { askAndSay } from "./askAndSay"
import { FLOAT } from "./dress"
import { Cap } from "./Cap"
import { ROOT_ID } from "./mount"
import { ARMED, COPY_LETTER, LETTER, LOOK, ORDER, WORD } from "./rowDoings"
import { useKeying, useLetters } from "./useLetters"

/**
 * What a row may ask GitHub for, and who to tell once it happened.
 *
 * One function rather than a field per verb, because a row does not choose
 * between them the way the merge card does — the state says which verbs exist
 * and this says how any of them is asked for. The screen that supplies it is
 * the one that knows which gateway it is talking to.
 */
export type Asking = {
  /**
   * Asks GitHub, and answers as GitHub did.
   *
   * There used to be a second half to this — somebody to tell once a verb
   * landed, so the list could read itself again. The screen supplying this one
   * shows the change before asking and puts it back if the answer is no, so both
   * answers this carries are the effect's own: failing is the refusal, and
   * succeeding is the sentence that offers the way back. See `askAndSay`, which
   * is where a surface turns either one into something the reader can read.
   */
  readonly ask: (doing: RowDoing, reference: PullRequestRef) => Effect.Effect<void, unknown>
}

/**
 * The verb inside a sentence, where a menu's capital would read as a shout.
 *
 * "Do not Close" against "Do not close": the label is read aloud by a screen
 * reader, and the card lowers its verb for the same line.
 */
const lowered = (words: string): string => `${words.charAt(0).toLowerCase()}${words.slice(1)}`

/**
 * What an armed item calls itself, which is the card's word for the same press.
 *
 * "Close it — press again" was the whole instruction written out, from before
 * there was anything to see: an item that only changed colour had to say how to
 * finish and how to stop. It now fills red and grows a cross, so the sentence is
 * on the screen and the word can go back to being a word. The card has said
 * "Confirm" beside its own filled button all along.
 */
const CONFIRM = "Confirm"

/**
 * Which of the verbs, if any, is armed and waiting for its second press.
 *
 * Two states, where it had four. A verb in flight and a verb GitHub refused were
 * both states of a menu that stayed open through the ask, and the menu has closed
 * on the press for as long as the list has moved the row itself — so neither was
 * reachable, while the spinner and the sentence they were drawn with sat in this
 * file as an example of an idiom nothing here follows. See `go` below for what
 * answers a verb instead, and `Says` for the buttons that do wait in place.
 */
type Step =
  | { readonly kind: "resting" }
  | { readonly kind: "armed"; readonly doing: RowDoing }

const ITEM =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-ink outline-none data-[disabled]:opacity-50"

/**
 * The lit item, which is every item whose colour is not already saying something.
 *
 * Held apart from {@link ITEM} rather than written into it, because an armed item
 * must not have it. Radix lights whatever the pointer is over, and the pointer is
 * by definition over the item that was just pressed — so the neutral grey landed
 * on top of the red the press had turned the item, and the one state in this menu
 * that has to be unmistakable looked exactly like idle hover.
 *
 * The card settles this the same way: a button wearing the tone of what it is
 * about to do does not repaint on hover, because the fill is the sentence and
 * there is nothing hover could add to it that is worth saying over it.
 */
const LIT = "data-[highlighted]:bg-hover"

/**
 * Everything that can be done to one pull request, from the list.
 *
 * The card asks the same questions of a pull request the reader has opened; a
 * row is the other place the answer is wanted, and until now it meant opening
 * the thing to close it. What is offered comes from the state alone — see
 * `whatStateAllows` — so a merged row has no button at all rather than a menu
 * of refusals.
 *
 * Portalled into the interface's own root rather than the row. Two reasons: a
 * menu inside a row is clipped by the shelf it sits in and painted under the
 * next one, and the list's keyboard stands down while a `role="menu"` is up,
 * which it can only see inside its own scope.
 *
 * Every item answers to its own letter while the menu is open, and the letter is
 * written on its face. A verb typed that way goes on one press — see `typed` —
 * because the sentence that reports it carries the way back out of it.
 */
export const Doings = ({
  one,
  asking,
  chosen
}: {
  readonly one: InvolvedPullRequest
  readonly asking: Asking
  /** Whether this is the row the keyboard is on, which keeps the button visible. */
  readonly chosen: boolean
}) => {
  const art = useArt()
  const Kebab = art.more
  const Cross = art.close
  const [open, setOpen] = useState(false)
  /*
   * Whether a key shut this menu, which decides whether it is animated on the way out.
   *
   * A letter typed on an open menu arms or lands a verb and shuts the menu in the same
   * press, and the toast that answers the verb was arriving underneath a menu that was
   * still leaving. Escape is the same argument with nothing to land. Cleared on every
   * open, so a pointer that finds the menu next gets the travel it expects.
   */
  const [byKey, setByKey] = useState(false)
  const [step, setStep] = useState<Step>({ kind: "resting" })
  const [copied, setCopied] = useState(false)
  /** Each verb's own item, so the cross beside one can hand the keyboard back. */
  const verbItem = useRef<Partial<Record<RowDoing, HTMLDivElement | null>>>({})
  // Whether a key cap is worth drawing, which is whether pressing it would do
  // anything. A promise on the face of an item is only worth making if it holds.
  const capped = useKeying().profile !== "off"

  // A menu that closed forgets what it was in the middle of. Reopening it on a
  // primed Close, or on a refusal from a minute ago, is the one way this could
  // act on a press the reader did not mean to still be making.
  useEffect(() => {
    if (!open) {
      setStep({ kind: "resting" })
      setCopied(false)
    }
  }, [open])

  const can = whatStateAllows(one.state)
  const verbs = ORDER.filter((doing) => can.has(doing))

  /**
   * Asking GitHub, which is the last thing this menu does.
   *
   * The menu goes now, not when GitHub answers. It used to stay up through the
   * whole ask, wearing "Asking GitHub…", because the answer was the only thing
   * that would move the row. The list moves on the press now — the pull request
   * is in its new Court before this menu has finished closing — so holding a
   * menu open over the top of the change it caused is asking the reader to watch
   * a spinner instead of the result.
   *
   * Which leaves both answers with nowhere to land, and that is what the toasts
   * are for: a refusal puts the row back and says why, and a verb that worked
   * says what it did and offers the way back out of it.
   */
  const go = (doing: RowDoing) => {
    setOpen(false)
    Effect.runFork(askAndSay(asking.ask, doing, one.reference))
  }

  const press = (doing: RowDoing) => {
    // A click is asked for twice. The first press arms the item; only a press on
    // an item that is already armed goes to GitHub. This button appears under
    // the pointer in a list being scrolled, and every verb in it is a thing
    // somebody else is told about: a draft marked ready is a review request in a
    // colleague's inbox, and "I brushed past it" is not something the inbox says.
    if (!(step.kind === "armed" && step.doing === doing)) {
      setStep({ kind: "armed", doing })
      return
    }

    go(doing)
  }

  /**
   * The same verb, asked for by typing its own letter.
   *
   * One press, where a click takes two. Nothing here is brushed past by accident:
   * the reader opened this menu and typed the letter written on the item, which is
   * a sentence they had to mean. What the second press was buying — a way to take
   * it back — is bought instead by the toast that follows, and that is a better
   * bargain in both directions: the mistake is undone after the fact rather than
   * prevented by a tax on every deliberate press.
   *
   * Merging is the exception the domain names. There is no way back out of it, so
   * there is nothing to offer afterwards and the press has to be confirmed
   * beforehand — the letter arms the item exactly as a click does, and a second
   * `m` lands it.
   */
  const typed = (doing: RowDoing) => {
    setByKey(true)
    if (Option.isNone(putsBack(doing))) {
      press(doing)
      return
    }

    go(doing)
  }

  const copy = () => {
    Effect.runFork(
      Effect.tryPromise(() => navigator.clipboard.writeText(linkTo(one.reference))).pipe(
        Effect.map(() => setCopied(true)),
        // A clipboard the platform would not open is not worth a sentence: the
        // reader can see the item did not change, and the address is on the row
        // behind the menu either way.
        Effect.catch(() => Effect.void)
      )
    )
  }

  /**
   * Every letter this menu answers to while it is up, and nothing when it is not.
   *
   * Worn by the content rather than added to the document, so the letters exist
   * for exactly as long as the thing offering them: see `useLetters`, which also
   * takes an answered press out of the air before the menu's own typeahead and
   * GitHub's page underneath can hear it.
   */
  const letters = useLetters({
    ...Object.fromEntries(verbs.map((doing) => [LETTER[doing], () => typed(doing)])),
    [COPY_LETTER]: copy
  })

  const wordFor = (doing: RowDoing): string => {
    if (step.kind === "armed" && step.doing === doing) return CONFIRM
    return WORD[doing]
  }

  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setByKey(false)
        setOpen(next)
      }}
    >
      <Menu.Trigger
        aria-label={`What to do with #${one.reference.number}`}
        /*
         * On the row always, quiet until it is wanted.
         *
         * It used to be `opacity-0` until the pointer arrived, which reads well on a screen
         * whose job is reading and fails the reader this list was rebuilt for: "why does this
         * appear on hover? Hover is terrible UX for discoverability", eleven times over. A
         * person who does not know a row can be merged from here will never hover to find out,
         * and on a touch screen there is no hover to do.
         *
         * So presence is unconditional and only emphasis moves: dim in the row's own muted
         * ink, full strength under the pointer, on the row the keyboard is standing on, and
         * while the menu is open. A column of forty dim glyphs is quieter than the title
         * beside it, which is as far out of the way as something discoverable can get.
         */
        className={`flex shrink-0 items-center rounded-md px-1 py-1 text-ink-muted transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 data-[state=open]:opacity-100 ${
          chosen ? "opacity-100" : "opacity-60 group-hover:opacity-100"
        }`}
      >
        <Kebab size={16} />
      </Menu.Trigger>
      <Menu.Portal container={document.getElementById(ROOT_ID)}>
        <Menu.Content
          align="end"
          sideOffset={4}
          onKeyDown={letters}
          onEscapeKeyDown={() => setByKey(true)}
          // A hand reaching past the menu is the one close that still wants its travel, and
          // the mark may be standing from a letter that armed a verb rather than landing one.
          onPointerDownOutside={() => setByKey(false)}
          // Read by the stylesheet, which drops the closing keyframe when it is there. Radix
          // waits for an animation before it unmounts, so no animation is also no wait.
          data-snap={byKey ? "" : undefined}
          className={`t-dropdown z-50 min-w-44 p-1 ${FLOAT}`}
        >
          {verbs.map((doing) => {
            const armed = step.kind === "armed" && step.doing === doing
            const Glyph = art[LOOK[doing].art]

            const asked = (
              <Menu.Item
                key={doing}
                ref={(node: HTMLDivElement | null) => {
                  verbItem.current[doing] = node
                }}
                /*
                 * Held open on purpose. A click here is a question asked twice,
                 * and a menu that shut on the first press would take the second
                 * one somewhere the reader cannot make it.
                 */
                onSelect={(event) => {
                  event.preventDefault()
                  press(doing)
                }}
                className={`${ITEM} ${
                  armed ? `rounded-r-none font-semibold ${ARMED[doing]}` : LIT
                }`}
              >
                <Glyph size={14} className={`shrink-0 ${armed ? "" : LOOK[doing].tone}`} />
                {wordFor(doing)}
                {/* At the far end, after the words, which is where a key cap goes
                    on every button in this interface. An armed item wears its own
                    tone, so the cap darkens what is under it rather than drawing a
                    grey border that the fill would swallow. */}
                {capped ? (
                  <span className="ml-auto pl-3">
                    <Cap chord={LETTER[doing]} tone={armed ? "onEmphasis" : "plain"} />
                  </span>
                ) : null}
              </Menu.Item>
            )

            /*
             * Armed, the item gains a half rather than the menu gaining a row.
             *
             * The card's arrangement, in a menu: what was pressed keeps the fill
             * and the words, and the way out arrives beside it as a cross of its
             * own — near enough to be the same gesture undone, separate enough
             * that the press which confirms cannot land on it by a pixel. The
             * seam between them is the menu showing through, which is why neither
             * half carries a border and both give up the corners they meet at.
             *
             * The pair is here whether or not anything is armed, holding one
             * half. A row that appeared only while armed would take the verb's
             * own item out of the document and put a new one back, which is a
             * remount in the middle of a press: the reader's place in the menu
             * goes with it.
             */
            return (
              <div key={doing} className="flex items-stretch gap-px">
                <div className="min-w-0 flex-1">{asked}</div>
                {/* Never disabled, because it only exists while this item is
                    armed and nothing has been asked of GitHub yet: the way out
                    is open for exactly as long as there is something to back out
                    of. */}
                {armed ? (
                  <Menu.Item
                    aria-label={`Do not ${lowered(WORD[doing])}`}
                    onSelect={(event) => {
                      event.preventDefault()
                      /*
                       * The verb takes the keyboard back before the cross goes.
                       *
                       * A menu whose focused item vanishes has no focused item,
                       * and Radix reads focus leaving the layer as the reader
                       * dismissing it — so cancelling used to shut the menu, and
                       * the reader who only meant "not that one" lost the other
                       * three as well.
                       */
                      verbItem.current[doing]?.focus()
                      setStep({ kind: "resting" })
                    }}
                    // Marked when a letter armed this verb, which drops the cross's slide-in:
                    // the reader pressed `m` and is about to press it again or press Escape,
                    // and the target they are aiming at should be where it will be.
                    data-snap={byKey ? "" : undefined}
                    className="t-doing-out flex shrink-0 cursor-pointer items-center rounded-r-md bg-surface px-2 text-ink-muted outline-none data-[highlighted]:text-ink"
                  >
                    <Cross size={12} />
                  </Menu.Item>
                ) : null}
              </div>
            )
          })}

          {/* Nothing above it on a merged row, and then nothing to separate.
              The menu used to be dropped whole where no verb applied, which took
              the copy with it: a merged pull request is the one every other row
              links to, and it was the one row whose address could not be had. */}
          {verbs.length === 0 ? null : (
            <Menu.Separator className="my-1 h-px bg-line-muted" />
          )}

          <Copying copied={copied} onCopy={copy} capped={capped} art={art} />
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/** Where a pull request is read by anybody who is not looking at this list. */
const linkTo = (reference: PullRequestRef): string =>
  `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}`

/**
 * The address of the thing, on the clipboard.
 *
 * The one item here that asks nothing of GitHub, and the one people reach for
 * most: a link pasted into a message is how a pull request gets read by anybody
 * who is not already looking at this list.
 *
 * Told whether it has been copied rather than remembering it. The letter `y` puts
 * the same address on the clipboard without this item being pressed at all, and an
 * item holding its own tick would show nothing when that happened — so the state
 * lives with the menu, which is what both ways of asking go through.
 */
const Copying = ({
  copied,
  onCopy,
  capped,
  art
}: {
  readonly copied: boolean
  readonly onCopy: () => void
  readonly capped: boolean
  readonly art: Set
}) => {
  const Tick = art.tick
  const Link = art.link

  return (
    <Menu.Item
      className={`${ITEM} ${LIT}`}
      onSelect={(event) => {
        event.preventDefault()
        onCopy()
      }}
    >
      {/* The tick is the whole of the feedback: a menu item that says Copied
          without changing colour has said it to nobody who was already looking
          away. Green, and only for as long as the menu stays open. */}
      {copied ? (
        <Tick size={14} className="shrink-0 text-pass" />
      ) : (
        <Link size={14} className="shrink-0 text-ink-muted" />
      )}
      {copied ? "Copied" : "Copy link"}
      {capped ? (
        <span className="ml-auto pl-3">
          <Cap chord={COPY_LETTER} />
        </span>
      ) : null}
    </Menu.Item>
  )
}
