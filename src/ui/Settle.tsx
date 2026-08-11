import * as Menu from "@radix-ui/react-dropdown-menu"
import { Effect, Option } from "effect"
import { useState } from "react"
import type { Settled, Settling } from "../domain/Issue"
import { type IssueRef, issueSaid, nameOf } from "../domain/issues"
import type { RepoRef } from "../domain/PullRequestRef"
import type { IssueState } from "../domain/issues"
import { type ArtName, useArt } from "./art"
import { Cap } from "./Cap"
import { ROOT_ID } from "./mount"
import { useKeying, useLetters } from "./useLetters"

export type SettleProps = {
  readonly state: IssueState
  /** Where the reader is, for a duplicate named by number alone. */
  readonly where: RepoRef
  /** What GitHub says this reader may do, which is not guessable from who raised it. */
  readonly allowed: { readonly close: boolean; readonly reopen: boolean }
  /**
   * Closes it, saying why. Rejects where GitHub refuses.
   *
   * A duplicate arrives here as an issue rather than as GitHub's name for one, because that
   * name is a read away and reading is the caller's job: this control knows what the reader
   * typed and nothing about a gateway.
   */
  readonly onSettle?: (settling: Settled) => Effect.Effect<void, unknown>
  /** Opens a closed one again. Rejects the same way. */
  readonly onReopen?: () => Effect.Effect<void, unknown>
}

/** Which of the three, in the words their own menu uses, with the glyph and the letter. */
const CLOSES: ReadonlyArray<{
  readonly as: Settling["as"]
  readonly word: string
  readonly why: string
  readonly art: ArtName
  readonly letter: string
}> = [
  {
    as: "completed",
    word: "Close as completed",
    why: "The thing asked for is done",
    art: "issue-closed",
    letter: "c"
  },
  {
    as: "discarded",
    word: "Close as not planned",
    why: "It is not going to be done",
    // Their own glyph for this state, which is a circle with a line through it: the mark for
    // a step that will not run, on the one close that says the work will not happen.
    art: "check-skipped",
    letter: "n"
  },
  {
    as: "duplicate",
    word: "Close as duplicate…",
    why: "Another issue already has it",
    art: "copy",
    letter: "d"
  }
]

/**
 * The one thing on an issue a reader does rather than reads.
 *
 * Three ways to close it, because GitHub has three and the difference is the whole point:
 * "Closed" alone hides whether the thing reported is ever going to be done, which is the
 * answer whoever raised it came back for. Reopening takes no reason, so it takes no menu.
 *
 * Four faults of their own control are answered here, from the accessibility thread on it
 * (`community/community` #156844, GitHub's own team in the replies):
 *
 * 1. Their reason picker hangs off an `aria-hidden` chevron, so a reader on NVDA or Orca
 *    cannot reach it at all. This is a button and a menu of items, which is what those two
 *    already know how to drive.
 * 2. Choosing a reason in theirs does not close anything — it re-labels the button, and the
 *    reader has to find their way back to it. Their own engineer wrote "it's not obvious that
 *    you also have to go back and click the Close button". One press here, one close.
 * 3. Their chosen reason is shown by a coloured glyph a screen reader never sees. The word is
 *    in the header's own state, and the header says it out loud on the change.
 * 4. Theirs is at the foot of the conversation, under however many comments there are. A
 *    Stack Overflow answer from June exists to tell people to scroll down and find it. This
 *    is on the title.
 *
 * Nothing at all where GitHub says this reader may not, which is a question only GitHub can
 * answer: a triager closes issues they did not raise, and an archived repository refuses
 * everyone. A button that throws when it is used is worse than no button.
 */
export const Settle = ({ state, where, allowed, onSettle, onReopen }: SettleProps) => {
  const art = useArt()
  const Chevron = art["chevron-down"]
  const [open, setOpen] = useState(false)
  /** Whether GitHub is being asked, which is what stops a second press landing twice. */
  const [asking, setAsking] = useState(false)
  /** The field for a duplicate, open on the one item that needs an answer before it can go. */
  const [naming, setNaming] = useState(false)
  const capped = useKeying() !== "off"

  const go = (asked: Effect.Effect<void, unknown> | undefined): void => {
    if (asked === undefined) return

    setOpen(false)
    setNaming(false)
    setAsking(true)
    // The refusal is the caller's to report and the caller's to put back: this control shows
    // whatever it is handed, and what it is handed is the screen's own picture of the issue.
    Effect.runFork(
      asked.pipe(
        Effect.catch(() => Effect.void),
        Effect.map(() => setAsking(false))
      )
    )
  }

  const chose = (as: Settling["as"]): void => {
    if (as === "duplicate") {
      // Held open, because a duplicate is not a press: it is a press and then a question.
      setNaming(true)
      return
    }

    go(onSettle?.({ as }))
  }

  const letters = useLetters(Object.fromEntries(CLOSES.map((one) => [one.letter, () => chose(one.as)])))

  if (state === "closed") {
    if (!allowed.reopen || onReopen === undefined) return null

    const Again = art.issue

    return (
      <button
        type="button"
        disabled={asking}
        onClick={() => go(onReopen())}
        className={`${FACE} gap-1.5 disabled:opacity-60`}
      >
        <Again size={12} />
        Reopen issue
      </button>
    )
  }

  if (!allowed.close || onSettle === undefined) return null

  /*
   * The field stands where the button stood, rather than beside it.
   *
   * Beside it was the first shape and it fought the menu: a Radix menu is modal, so a field
   * outside it cannot be typed into while it is open, and a menu that stayed open over its own
   * question is the fault this control exists to fix in theirs. So the press chooses, the menu
   * goes, and the header asks one question in the space the button was in.
   */
  if (naming) {
    return (
      <Naming
        where={where}
        onName={(of) => go(onSettle({ as: "duplicate", of }))}
        onDrop={() => setNaming(false)}
      />
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {/* The menu forgets nothing on the way out. It used to clear the field's own state as it
          closed, which is the same tick the duplicate item sets it in: the question was asked
          and unasked in one press, and the header went back to a button. */}
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger disabled={asking} className={`${FACE} gap-1.5 disabled:opacity-60`}>
          Close issue
          <Chevron size={12} />
        </Menu.Trigger>
        <Menu.Portal container={document.getElementById(ROOT_ID)}>
          <Menu.Content
            align="end"
            sideOffset={4}
            onKeyDown={letters}
            className="t-dropdown z-50 min-w-60 rounded-md border border-line bg-raised p-1 shadow-pop"
          >
            {CLOSES.map((one) => {
              const Glyph = art[one.art]

              return (
                <Menu.Item
                  key={one.as}
                  className={ITEM}
                  onSelect={() => chose(one.as)}
                >
                  <Glyph size={14} />
                  <span className="flex flex-col">
                    <span>{one.word}</span>
                    <span className="text-ink-muted">{one.why}</span>
                  </span>
                  {capped ? (
                    <span className="ml-auto pl-2">
                      <Cap chord={one.letter} />
                    </span>
                  ) : null}
                </Menu.Item>
              )
            })}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}

/**
 * Which issue this one duplicates, asked as a field rather than as a search.
 *
 * Their own control opens a sub-menu and searches issue titles, and the thread on it has
 * GitHub's own team wondering whether that sub-menu confuses people. A reader closing a
 * duplicate has the other issue open in a tab, so the shortest road is the address they are
 * already holding: `#78`, `owner/repo#78`, or the whole link, all of which `issueSaid` takes.
 *
 * The submit is refused rather than sent while nothing in the field names an issue. Sending a
 * guess would close the reader's issue as a duplicate of something they never named.
 */
const Naming = ({
  where,
  onName,
  onDrop
}: {
  readonly where: RepoRef
  readonly onName: (of: IssueRef) => void
  readonly onDrop: () => void
}) => {
  const [said, setSaid] = useState("")
  const meant = issueSaid(said, where)

  return (
    <form
      className="flex shrink-0 items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        if (Option.isSome(meant)) onName(meant.value)
      }}
    >
      <label className="sr-only" htmlFor="gitquiet-duplicate">
        Which issue is this a duplicate of
      </label>
      <input
        id="gitquiet-duplicate"
        autoFocus
        value={said}
        onChange={(event) => setSaid(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDrop()
        }}
        placeholder="#78, owner/repo#78, or a link"
        className="w-56 rounded-md border border-line bg-inset px-2 py-1 text-xs text-ink placeholder:text-ink-muted"
      />
      {/* The name it read back, so the press is made against what was understood rather than
          against what was typed. A number in one repository and a number in another look
          almost the same in a field and are two different issues. */}
      <span className="text-xs text-ink-muted tabular-nums">
        {Option.match(meant, { onNone: () => "", onSome: (of) => nameOf(of) })}
      </span>
      <button type="submit" disabled={Option.isNone(meant)} className={`${FACE} disabled:opacity-40`}>
        Close as duplicate
      </button>
      <button type="button" onClick={onDrop} className={FACE}>
        Cancel
      </button>
    </form>
  )
}

/** The same face as the other controls in this header, neither loud nor hidden. */
const FACE =
  "flex shrink-0 items-center rounded-md border border-line px-2.5 py-1 text-xs text-ink hover:bg-hover"

const ITEM =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-ink outline-none data-[highlighted]:bg-hover data-[disabled]:opacity-50"

/**
 * What each of the three closes says once it has happened, for the sentence a screen shows.
 *
 * Here rather than in the screen because it is the same distinction this control exists for,
 * and a screen that wrote its own words for it would drift from the words on the menu.
 */
export const SETTLED: Record<Settling["as"], string> = {
  completed: "closed as completed",
  discarded: "closed as not planned",
  duplicate: "closed as a duplicate"
}
