import * as Menu from "@radix-ui/react-dropdown-menu"
import { Effect, Option } from "effect"
import type { MergeMethod, UpdateWay } from "../domain/PullRequest"
import type { Doing, RowDoing } from "../domain/doable"
import type { ArtName } from "./art"
import { useArt } from "./art"
import { LOOK } from "./rowDoings"
import { ROOT_ID } from "./mount"
import { Says } from "./says"

export type MergeActions = {
  /**
   * Merges it, the way the card says it would. Rejects with something worth
   * reading when GitHub refuses.
   *
   * The one verb here that takes an argument, and it is handed down rather than
   * looked up again: the way in is on the merge state this card is drawing, so
   * the word on the button and the method the press sends are one read of one
   * field. They used to be two, in two workspaces, and one of them read it
   * wrong. See `MergeState.method`.
   */
  readonly merge?: (method: MergeMethod) => Effect.Effect<void, unknown>
  /** Puts it in the queue, on the repositories that land through one. */
  readonly enqueue?: () => Effect.Effect<void, unknown>
  /** Takes it back out of the queue it is standing in. */
  readonly dequeue?: () => Effect.Effect<void, unknown>
  /** Calls off a merge GitHub is holding until this becomes mergeable. */
  readonly cancel?: () => Effect.Effect<void, unknown>
  /**
   * Catches the branch up with the one it would land on, the way it is asked.
   *
   * The way is an argument for the reason the merge method is one: a repository
   * can allow both, the two write different history, and the choice belongs to
   * whoever pressed. See `BranchUpdate.ways`.
   */
  readonly update?: (how: UpdateWay) => Effect.Effect<void, unknown>
  /**
   * Closes it without merging.
   *
   * Asked for twice, like the merge, and for the same reason: it is the other
   * control here that ends the reading. Nothing is destroyed by it — GitHub
   * keeps the branch, the comments and the diff, and will reopen it — so what
   * the second press agrees to says so.
   */
  readonly close?: () => Effect.Effect<void, unknown>
  /**
   * Takes it out of draft.
   *
   * The one blocker on this card that is nobody's rule: a draft is a state its
   * author chose and can unchoose, and GitHub's own words for it — the pull
   * request must not be in draft mode — read like a condition being reported
   * rather than a switch being offered.
   */
  readonly markReady?: () => Effect.Effect<void, unknown>
  /** Puts it back into draft, so the offer above is a door both ways. */
  readonly toDraft?: () => Effect.Effect<void, unknown>
  /**
   * Opens a closed one again.
   *
   * The card never asks for this — a settled pull request wears the settled
   * face and that face has no controls — but the verb is the domain's, and the
   * list offers it on rows this card is never shown for.
   */
  readonly reopen?: () => Effect.Effect<void, unknown>
  /**
   * Deletes the branch the pull request was made from.
   *
   * The one thing this card asks for that is not about the pull request, and the
   * only control on the settled face: a merged pull request has no decisions
   * left, and the branch it came from is the one loose end it leaves behind.
   * Asked twice, because GitHub restores a deleted branch from their own page
   * and this does not.
   */
  readonly deleteBranch?: () => Effect.Effect<void, unknown>
}

/**
 * Everything a press on this card can ask for.
 *
 * The domain's verbs, and one more that is not one of them. `Doing` is what can
 * be done to a pull request, and deleting a branch is not that — it survives the
 * pull request, and GitHub answers whether it may go in a field of its own
 * rather than through the merge requirements every `Doing` is weighed against.
 * So the card carries the wider vocabulary and the domain keeps the narrower.
 */
export type Asking = Doing | "deleteBranch"

/**
 * Which of the things asked for is in flight.
 *
 * One state machine rather than eight, because they cannot overlap: a pull
 * request being queued is not also being merged, and a second machine would
 * only make that expressible. Which of them may be asked for at all is not this
 * card's to decide — see `whatCanBeDone` in the domain.
 */
export type Merging =
  | { readonly step: "idle" }
  | { readonly step: "asking"; readonly doing: Asking }
  | { readonly step: "working"; readonly doing: Asking }
  /**
   * What GitHub agreed to, said on the button that asked for it.
   *
   * A word and not a hold. The pull request behind it is being read again, and
   * what comes back decides what may be pressed next — see `whatCanBeDone`,
   * which is the only thing entitled to grey a verb once nothing is in flight.
   */
  | { readonly step: "done"; readonly doing: Asking }
  | { readonly step: "refused"; readonly said: string }

/**
 * What each verb calls itself, at rest, while running, and once it is done.
 *
 * One table for the eight of them, keyed by the domain's own word for what is
 * being asked. Before this, every button carried its three words as three props
 * at the call site, and the queue's three were a second table beside it — so
 * whether a control existed, whether it could be pressed and what it said were
 * decided in three different places for each one.
 */
type Wording = { readonly rest: string; readonly working: string; readonly done: string }

const WORDS: Record<Asking, Wording> = {
  deleteBranch: { rest: "Delete branch", working: "Deleting…", done: "Branch deleted" },
  // The way in is the repository's to decide, so the resting word is replaced by
  // {@link wordsOf} wherever the merge state names one. What stands here is the
  // word for a press whose method nothing has said — greyed out, since
  // `whatCanBeDone` refuses a merge it cannot name a method for.
  merge: { rest: "Merge", working: "Merging…", done: "Merged" },
  // "Joining the queue…" once, which was the one waiting word longer than its own
  // verb. Every word a button says now stands in one cell as wide as the widest of
  // them — see {@link Says} — so a long wait is paid for by a resting button that
  // is wider than the words on it, and the queue is named in the paragraph above.
  enqueue: { rest: "Merge when ready", working: "Joining…", done: "Queued" },
  dequeue: { rest: "Remove from the queue", working: "Removing…", done: "Removed" },
  cancel: { rest: "Cancel merge when ready", working: "Cancelling…", done: "Cancelled" },
  update: { rest: "Update branch", working: "Updating…", done: "Updated" },
  close: { rest: "Close pull request", working: "Closing…", done: "Closed" },
  markReady: {
    rest: "Mark ready for review",
    working: "Marking ready…",
    done: "Ready for review"
  },
  toDraft: { rest: "Convert to draft", working: "Converting…", done: "Draft" },
  reopen: { rest: "Reopen pull request", working: "Reopening…", done: "Open" }
}

/**
 * How each verb is dressed, at rest and once it is armed.
 *
 * Green for the ones that land a change, red for the ones that end a pull
 * request or take it out of the line, blue for the rest. Never the same pair
 * twice over: a control that looks identical before and after a press has not
 * told anybody that the next one acts.
 */
const TONE: Record<Asking, { readonly rest: string; readonly armed: string }> = {
  // Red on both, like closing: the branch is the one thing here a press takes
  // away rather than moves.
  deleteBranch: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  merge: {
    rest: "bg-pass-emphasis text-ink-on-emphasis",
    armed: "bg-pass-emphasis text-ink-on-emphasis"
  },
  enqueue: {
    rest: "bg-pass-emphasis text-ink-on-emphasis",
    armed: "bg-pass-emphasis text-ink-on-emphasis"
  },
  dequeue: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  cancel: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  /*
   * A fill rather than the card's own, which is what makes it a secondary button
   * instead of a line of text.
   *
   * It gained a caret, and a split with no fill is a label with a chevron
   * floating beside it: the seam between the halves is the surface behind them
   * showing through, and on `bg-surface` there was nothing to show. `bg-canvas`
   * is what every other quiet control in this interface is drawn on — the file
   * band's own buttons, the rail's head — so this is the house answer rather
   * than a colour chosen for one button.
   */
  update: { rest: "bg-canvas text-ink", armed: "bg-accent-emphasis text-ink-on-emphasis" },
  close: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  markReady: {
    rest: "bg-accent-emphasis text-ink-on-emphasis",
    armed: "bg-accent-emphasis text-ink-on-emphasis"
  },
  toDraft: { rest: "bg-surface text-ink-muted", armed: "bg-accent-emphasis text-ink-on-emphasis" },
  reopen: { rest: "bg-surface text-ink", armed: "bg-pass-emphasis text-ink-on-emphasis" }
}

/**
 * What the press that lands the change is called, per way of merging.
 *
 * GitHub's own three words, from their own button. Which of the three applies
 * is the repository's answer, on the merge state — see `MergeState.method`.
 */
const MERGE_WORD: Record<MergeMethod, string> = {
  MERGE: "Merge pull request",
  SQUASH: "Squash and merge",
  REBASE: "Rebase and merge"
}

/**
 * The same three, where the press lands a stack rather than one pull request.
 *
 * The stack in the word, because this is the one control on the interface that
 * lands several pull requests, and "Squash and merge" is the label for landing
 * one. GitHub's own button here says "Merge stack" and drops the method; the
 * method names the commits the repository is about to write, several of them
 * now, so it has more claim to the button than it had on one.
 */
const STACK_MERGE_WORD: Record<MergeMethod, string> = {
  MERGE: "Merge stack",
  SQUASH: "Squash and merge stack",
  REBASE: "Rebase and merge stack"
}

/**
 * What a button says, once the repository has had its say about merging.
 *
 * Every verb but the merge reads straight off {@link WORDS}. The merge is the
 * one whose resting word is not ours: it names the commit the repository writes,
 * and a card that has not been told which keeps the plain word.
 */
/**
 * What one merge method is called, wherever it is offered.
 *
 * On the button and in the menu behind it, which is why it is a function rather
 * than a table read twice: a method whose two names disagreed would be a menu
 * whose tick lands on a word the button does not say.
 */
/**
 * The same press, where the repository lands through a merge queue.
 *
 * A layer of a stack is the one thing this button still asks for on a queued
 * repository — see `whatCanBeDone`, which sends a layer by the stack's own route
 * whatever the queue does. That press joins the queue rather than landing
 * anything now, so a word naming a commit would promise work the queue has not
 * agreed to do yet, and "Merge stack" would say the merge had happened.
 *
 * GitHub's own button drops the method here and says one of these two. So does
 * this, and for their reason rather than by copying them: the method is still
 * sent and still decides the commits, but it is not what the press does next.
 */
const QUEUED_STACK_WORD = "Enqueue stack"
const QUEUED_LAYER_WORD = "Enqueue pull request"

export const mergeWord = (
  method: MergeMethod,
  landsStack: boolean,
  /** Whether the press joins a queue rather than landing now. */
  queued = false
): string =>
  queued
    ? landsStack
      ? QUEUED_STACK_WORD
      : QUEUED_LAYER_WORD
    : (landsStack ? STACK_MERGE_WORD : MERGE_WORD)[method]

/**
 * What each way of catching a branch up is called.
 *
 * GitHub's own two words, from their own menu. A merge writes a commit into the
 * branch and always works; a rebase moves the branch onto the base and keeps the
 * history flat, which is why a reader who wants one of them wants it every time.
 */
export const UPDATE_WORD: Record<UpdateWay, string> = {
  MERGE: "Update with merge commit",
  REBASE: "Update with rebase"
}

const wordsOf = (
  doing: Asking,
  method: Option.Option<MergeMethod>,
  landsStack: boolean,
  queued = false
): Wording =>
  doing === "merge" && Option.isSome(method)
    ? { ...WORDS.merge, rest: mergeWord(method.value, landsStack, queued) }
    : WORDS[doing]

/** What the second press is called, on a control that asks before it acts. */
const CONFIRM = "Confirm"

/**
 * What a button says: its verb, unless the thing being done is its own.
 *
 * Every button on this row shares one state machine, and each used to read that
 * machine's step without checking whose it was — so asking to close said
 * "Merging…" on the button beside it.
 */
const labelFor = (merging: Merging, doing: Asking, asking: boolean, words: Wording): string => {
  if (asking) return CONFIRM
  if (merging.step === "working" && merging.doing === doing) return words.working
  if (merging.step === "done" && merging.doing === doing) return words.done
  return words.rest
}

/**
 * The four things one of these buttons can say, in the order a press says them.
 *
 * The order is what the words travel along: each one leaves upward as the next
 * arrives from below, and a press that is backed out runs the same pair the other
 * way. It is also the width of the button, for the whole time it is on the screen
 * — see {@link Says}.
 */
const wordsFor = (words: Wording): ReadonlyArray<string> => [
  words.rest,
  CONFIRM,
  words.working,
  words.done
]

/**
 * The other ways one press could land, for the button that has more than one.
 *
 * A word, whether it is the one in use, and what to do about it. Written that
 * way rather than as a merge method or an update way because both of those
 * buttons want the same control and neither of their vocabularies belongs to
 * the other — and because a value that travelled through here as a string would
 * have to be cast back into its own type at the far end, which is a cast that
 * can be wrong. Whoever builds one of these has the type and keeps it.
 *
 * Never handed in with one entry. A caret over a menu of one is a control that
 * looks like a choice and is not, and both callers already know when they have
 * nothing to offer.
 */
export type Otherwise = ReadonlyArray<{
  readonly word: string
  /**
   * The glyph beside it, named by whoever built the entry.
   *
   * Here for the reason the word is: this control serves two vocabularies and
   * belongs to neither, so it is handed the drawing rather than working one out
   * from a method it would have to be told about. A caller that has the type
   * knows which picture goes with it.
   */
  readonly art: ArtName
  /** Whether this is the one the button says, which is where the tick goes. */
  readonly on: boolean
  readonly pick: () => void
}>

/**
 * The caret beside a button, and the ways behind it.
 *
 * GitHub's own merge button keeps its three methods here and so does their
 * Update branch, so this is the shape the reader's hand is already looking for.
 * A menu rather than a row of buttons because the choice is made rarely and read
 * constantly: the word that matters is on the button, and the other two are one
 * click away rather than two thirds of the width away.
 *
 * Drawn inside our own root for the reason `SettingsMenu` gives: the colours are
 * inline custom properties on that element, and a menu portalled to the body
 * comes out wearing the light pack over a dark page.
 */
const Caret = ({
  otherwise,
  label,
  disabled,
  dim,
  tone
}: {
  readonly otherwise: Otherwise
  readonly label: string
  readonly disabled: boolean
  /**
   * Whether the verb beside it is greyed, which this half follows without being
   * greyed itself.
   *
   * Two halves of one shape in two different greens read as a fault in the
   * drawing rather than as one half being pressable — and one half is pressable,
   * on every pull request that cannot land yet. So the pair dims together and
   * the hover veil is what says this half is still live: a control that answers
   * the pointer is a control that works, and nothing has to be said about it.
   */
  readonly dim: boolean
  readonly tone: string
}) => {
  const art = useArt()
  const Down = art["chevron-down"]
  const Tick = art.tick
  const inOurs = typeof document === "undefined" ? null : document.getElementById(ROOT_ID)

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        aria-label={`Other ways to ${label}`}
        className={`t-ask-more text-xs font-semibold disabled:opacity-50 ${
          dim ? "opacity-50" : ""
        } ${tone}`}
      >
        <Down size={12} />
      </Menu.Trigger>
      <Menu.Portal container={inOurs}>
        <Menu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-44 rounded-md bg-raised p-1 text-ink shadow-lg ring-1 ring-line"
        >
          {otherwise.map((way) => {
            const Glyph = art[way.art]

            return (
              <Menu.Item
                key={way.word}
                onSelect={way.pick}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none data-[highlighted]:bg-hover"
              >
                {/* The tick keeps its space on every row, so the words line up and
                    the list does not shift as the answer moves down it. */}
                <span className="flex w-3.5 shrink-0 justify-center">
                  {way.on ? <Tick size={12} /> : null}
                </span>
                {/* Muted, all three of them. The tick is what says which way is in
                    use, and a glyph coloured to agree with it would be saying it
                    twice — while three coloured glyphs in a list of three read as
                    three different kinds of thing. */}
                <Glyph size={14} className="text-ink-muted" />
                {way.word}
              </Menu.Item>
            )
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/**
 * The verbs that did not get a button, behind one glyph at the end of the row.
 *
 * A card with four controls in a four-hundred pixel column is a card whose row
 * wraps, and what wrapped was never chosen: the two that fell to the second line
 * were the two nobody presses. So the row keeps what a reader came for and the
 * rest go here.
 *
 * No state of its own. Each item drives the same {@link press} the buttons drive
 * and reads the same {@link Merging}, so a verb asked for here arms, confirms,
 * reports and refuses exactly as it would have on the row — the words on the
 * item are the words that were on the button, from the same table.
 *
 * The menu is held open through the first press for the reason the row menu
 * holds its own open: a question asked twice cannot be asked twice by a control
 * that leaves after the first half.
 */
export const Overflow = ({
  verbs,
  merging,
  can,
  actions,
  press,
  onCancel,
  landsStack = false
}: {
  /**
   * In the order they are offered, which is rarest last.
   *
   * The narrower vocabulary, and deliberately: every item here wears the glyph
   * of the state its verb leads to, and {@link LOOK} answers for those five and
   * no more. A verb added to this menu that has no glyph is a compile error
   * rather than an item drawn blank.
   */
  readonly verbs: ReadonlyArray<RowDoing>
  readonly merging: Merging
  readonly can: ReadonlySet<Asking>
  readonly actions?: MergeActions
  readonly press: (doing: Asking) => void
  readonly onCancel: () => void
  readonly landsStack?: boolean
}) => {
  const art = useArt()
  const More = art.more
  const inOurs = typeof document === "undefined" ? null : document.getElementById(ROOT_ID)
  const offered = verbs.filter((doing) => actions?.[doing] !== undefined)
  if (offered.length === 0) return null

  return (
    <Menu.Root
      // Leaving withdraws the question. A verb left armed behind a closed menu is
      // a press the reader has forgotten making, waiting for a second one.
      onOpenChange={(open) => {
        if (!open && merging.step === "asking") onCancel()
      }}
    >
      <Menu.Trigger
        aria-label="More to do with this pull request"
        className="flex shrink-0 items-center rounded-md px-1.5 py-1.5 text-ink-muted hover:bg-hover hover:text-ink"
      >
        <More size={16} />
      </Menu.Trigger>
      <Menu.Portal container={inOurs}>
        <Menu.Content
          align="end"
          sideOffset={4}
          className="t-dropdown z-50 min-w-44 rounded-md bg-raised p-1 text-ink shadow-pop ring-1 ring-line"
        >
          {offered.map((doing) => {
            const words = wordsOf(doing, Option.none(), landsStack)
            const asking = merging.step === "asking" && merging.doing === doing
            const stopped = !can.has(doing) || merging.step === "working"
            const look = LOOK[doing]
            const Glyph = art[look.art]

            return (
              <Menu.Item
                key={doing}
                disabled={stopped && !asking}
                /*
                 * Held open on purpose, the way the row's own menu holds itself
                 * open: a click here is half a question, and a menu that shut on
                 * the first press would take the second one somewhere the reader
                 * cannot make it.
                 */
                onSelect={(event) => {
                  event.preventDefault()
                  press(doing)
                }}
                /*
                 * The one that ends a pull request wears a red of its own while
                 * it rests, which none of the others do: it sits in a list of
                 * ordinary choices and is the only one there is no way back from
                 * on this card. Muted rather than filled, because filled is what
                 * the next press looks like — see {@link TONE} — and a rest that
                 * already looks armed says nothing when the arming happens.
                 */
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[highlighted]:bg-hover ${
                  asking
                    ? `font-semibold ${TONE[doing].armed}`
                    : doing === "close"
                      ? "bg-fail-muted"
                      : ""
                }`}
              >
                {/* Dimmed with the item it sits in, and never on its own: an
                    unpressable verb whose glyph still carried its full colour
                    read as the one thing on the menu that was available. */}
                <Glyph size={14} className={asking ? undefined : look.tone} />
                {labelFor(merging, doing, asking, words)}
              </Menu.Item>
            )
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

/**
 * A button that asks before it acts, without becoming somewhere else.
 *
 * The asking used to happen around the button rather than in it: the label grew
 * a "Confirm" in front of it, a Cancel appeared at the end of the row, and a
 * sentence arrived above the whole card. Three changes to read, none of them
 * where the finger already was, for one press.
 *
 * So it splits in place instead. The verb stays exactly where it was and keeps
 * saying what it does, and a cross grows onto its edge as the way out. The
 * accessible names carry what the shape shows a sighted reader — that this press
 * is the one that acts, and that one is the one that does not — because
 * "Convert to draft" said twice would be two buttons nobody could tell apart.
 */
export const Ask = ({
  doing,
  merging,
  can,
  actions,
  press,
  onCancel,
  method = Option.none(),
  otherwise,
  landsStack = false,
  queued = false,
  className = ""
}: {
  /** What this button asks for, which decides its words, its colours and its name. */
  readonly doing: Asking
  readonly merging: Merging
  /**
   * What may be asked of this pull request, from the domain.
   *
   * The whole of why a button is grey, in one answer: past deciding, refused by
   * GitHub, or beyond the reader's permissions. Each button used to work its own
   * out of whichever facts it had to hand, which is how a merged pull request
   * came to be offered a place in the merge queue.
   */
  readonly can: ReadonlySet<Asking>
  readonly actions?: MergeActions
  readonly press: (doing: Asking) => void
  readonly onCancel: () => void
  /**
   * The way this repository merges, which only the merge button reads.
   *
   * Defaulted to none, which is the settled face: the one control there deletes
   * a branch, and nothing about how a landed pull request landed is in reach.
   */
  readonly method?: Option.Option<MergeMethod>
  /**
   * The other ways this press could land, where there is more than one.
   *
   * Absent on the seven buttons that do one thing, and on a repository that
   * allows one way in — which is most of them.
   */
  readonly otherwise?: Otherwise
  /**
   * Whether the press this button asks for lands a stack of pull requests
   * rather than the one being read — see `wouldLand`, which is the fact and
   * not the seat: a half-landed stack read from its last open layer is down to
   * an ordinary merge, whatever the panel above still draws.
   */
  readonly landsStack?: boolean
  /**
   * Whether this press joins a merge queue rather than landing now.
   *
   * Only the merge button reads it, and only a layer of a stack reaches it on a
   * queued repository: every other press there is the queue's own verb, which
   * carries its own word. See {@link mergeWord}.
   */
  readonly queued?: boolean
  readonly className?: string
}) => {
  const art = useArt()
  const Close = art.close
  // Resolved once and handed to all four readers. Resolved four times over, the
  // one that skipped it — the waiting word — was right only for as long as
  // {@link wordsOf} replaced nothing but the resting word.
  const words = wordsOf(doing, method, landsStack, queued)
  const verb = words.rest
  const tone = TONE[doing]
  const named = `${verb.charAt(0).toLowerCase()}${verb.slice(1)}`
  const asking = merging.step === "asking" && merging.doing === doing
  /*
   * Nothing may be pressed while GitHub is being asked, and nothing at all
   * where the screen it lives on wired no action to it.
   *
   * While it is being asked, and no longer. `done` held the row down as well,
   * and nothing ever leaves `done` — so a verb that worked and left a pull
   * request still worth reading killed every control on the card for the rest
   * of the session. Marking a draft ready, joining a queue, catching a branch
   * up: each of them ends with nine dead verbs and no way back but a reload.
   * Recorded on `flazouh/stack-probe#51`, where marking it ready left Squash
   * and merge, Convert to draft and Close pull request all greyed out over a
   * card that had already read the pull request again and drawn it correctly.
   *
   * A refusal has always handed the controls back, and a write GitHub agreed
   * to has more claim to than one it turned down. What `done` is for is the
   * word on the button, which is a thing to read rather than a state to be
   * held in.
   */
  const busy = merging.step === "working"
  const disabled = !can.has(doing) || actions?.[doing] === undefined || busy

  return (
    <span
      className={`t-ask ${className}`}
      data-asking={asking ? "" : undefined}
      // Says there is a second half, so the verb keeps its flat right edge. The
      // caret is drawn only where it is offered and only while the button is not
      // asking, and both halves have to agree about the shape either way.
      data-more={otherwise !== undefined && !asking ? "" : undefined}
    >
      {/* One control in two halves, rather than a button and a button beside it. */}
      <span className="t-ask-group">
        <button
          type="button"
          disabled={disabled && !asking}
          aria-label={asking ? `Confirm ${named}` : undefined}
          // Said as well as drawn. The word swaps and a circle turns, both of which
          // are for the eye; this is the same fact for a reader who is being told
          // what the control they are standing on is doing.
          aria-busy={busy && merging.doing === doing ? true : undefined}
          onClick={() => press(doing)}
          className={`t-ask-yes text-xs font-semibold disabled:opacity-50 ${
            asking ? tone.armed : tone.rest
          }`}
        >
          <Says
            among={wordsFor(words)}
            said={labelFor(merging, doing, asking, words)}
            waiting={words.working}
          />
        </button>
        {/* Gone while the button is asking. The reader is two presses into one
            act, and a menu that changed what the second press would do is a menu
            that rewrites the question after it was asked. It comes back with the
            resting word. */}
        {otherwise !== undefined && !asking ? (
          <Caret
            otherwise={otherwise}
            label={named}
            /*
             * Not greyed with the button beside it. The button asks whether the
             * press would land now; this asks how it would land, and a pull
             * request spends most of its life unable to land — checks running, a
             * review outstanding, the base moved on. Greyed with the button, the
             * one control that answers "which way does this repository merge"
             * was unreadable in exactly the state a reviewer reads it in.
             *
             * A write already in flight is the one case that stands it down:
             * changing the method while GitHub is being asked would be changing
             * the question after it was sent. So is having nobody to send it to.
             */
            disabled={busy || actions?.[doing] === undefined}
            dim={disabled}
            tone={tone.rest}
          />
        ) : null}
      </span>
      {/* Mounted only while it is wanted, and grown from nothing rather than
          dropped in: the cell it lives in opens from no width at all, so the
          control gains a half instead of the row gaining a button. */}
      {asking ? (
        <span className="t-ask-out">
          <button
            type="button"
            aria-label={`Do not ${named}`}
            onClick={onCancel}
            className="t-ask-no bg-surface text-ink-muted hover:text-ink"
          >
            <Close size={12} />
          </button>
        </span>
      ) : null}
    </span>
  )
}

