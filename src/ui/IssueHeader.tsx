import type { Effect } from "effect"
import { Option } from "effect"
import type { Closing, IssueSnapshot, Label, Settled } from "../domain/Issue"
import type { IssueRef, IssueState, ListedIssue } from "../domain/issues"
import type { Participant } from "../domain/PullRequest"
import { issueName, useArt } from "./art"
import { CARD, CHIP } from "./dress"
import { toneOf } from "./labelTone"
import { Settle } from "./Settle"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * Which of the two states, and why, in the fewest words that still say it.
 *
 * A closed issue is not one thing. "Closed as not planned" is the answer
 * somebody came for when they want to know whether the thing they reported is
 * ever going to be done, and it is exactly what the word "Closed" alone hides.
 */
const CLOSING_WORD: Record<Closing, string> = {
  completed: "Closed",
  discarded: "Closed as not planned",
  duplicate: "Closed as duplicate"
}

/**
 * Two tones for two states, against a pull request's four.
 *
 * The reason closes the gap the colour cannot: an issue discarded and an issue
 * completed are the same colour here, because both are settled and colouring
 * them apart would say one of them went wrong.
 */
const wordOf = (snapshot: IssueSnapshot): string =>
  snapshot.state === "open"
    ? "Open"
    : Option.match(snapshot.closing, {
        onNone: () => "Closed",
        onSome: (closing) => CLOSING_WORD[closing]
      })

/**
 * A label in the colour GitHub gives it.
 *
 * Their colour rather than one hashed from the name, unlike the Working Set's
 * rows, because this route sends it. The ink is decided from the fill rather
 * than fixed: GitHub's palette runs from near-black to near-white, and one ink
 * over all of it is unreadable at one end.
 */
const Chip = ({ label }: { readonly label: Label }) => (
  <span
    title={Option.getOrUndefined(label.description)}
    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
    style={{
      backgroundColor: `#${label.colour}`,
      color: readableOn(label.colour)
    }}
  >
    {label.name}
  </span>
)

/**
 * Black or white over a fill, by how bright the fill is.
 *
 * The same weighting every browser and design system uses for this, because
 * the eye is far more sensitive to green than to blue. A fill that will not
 * parse is treated as dark, which errs towards white ink on a chip nobody can
 * see rather than towards black ink on a chip nobody can see.
 */
const readableOn = (colour: string): string => {
  const value = Number.parseInt(colour, 16)
  if (!Number.isInteger(value) || colour.length !== 6) return "#ffffff"

  const red = (value >> 16) & 0xff
  const green = (value >> 8) & 0xff
  const blue = value & 0xff

  return 0.299 * red + 0.587 * green + 0.114 * blue > 150 ? "#000000" : "#ffffff"
}

/**
 * Which of the two states, and how long since the issue was raised.
 *
 * One pill for both headers below rather than the same dozen classes twice. The
 * word is what this header exists to say, and what a screen reader hears of it
 * is part of the contract: two copies of this would be the two headers
 * disagreeing about the issue the reader is looking at.
 */
const TheState = ({
  state,
  word,
  raisedAt
}: {
  readonly state: IssueState
  readonly word: string
  readonly raisedAt: string
}) => {
  const art = useArt()
  const Art = art[issueName(state)]
  const age = ageOf(raisedAt)

  return (
    <span
      aria-label={`${word} ${age}`}
      /*
       * Said out loud when it changes, which is the third fault in the thread on GitHub's
       * own close button: theirs shows the reason as a coloured glyph, and a screen reader
       * is never told the issue closed at all. The word is here anyway, so announcing it
       * costs one attribute.
       */
      aria-live="polite"
      title={`Opened ${momentOf(raisedAt)}`}
      className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
        state === "open"
          ? "bg-pass-emphasis text-ink-on-emphasis"
          : "bg-done-emphasis text-ink-on-emphasis"
      }`}
    >
      <Art size={12} />
      {word}
      <span className="font-normal opacity-80 tabular-nums">{age}</span>
    </span>
  )
}

/**
 * The number, in the place both headers keep it.
 *
 * Not `Number`, which is the global this file's own colour arithmetic calls
 * `Number.parseInt` on.
 */
const TheNumber = ({ of: reference }: { readonly of: IssueRef }) => (
  <span className={`${CHIP} shrink-0 font-mono text-base font-semibold tabular-nums text-ink`}>
    {`#${reference.number}`}
  </span>
)

/** Who raised it, said the same way on both headers. */
const Raiser = ({ person }: { readonly person: Participant }) => (
  <span className="flex shrink-0 items-center gap-1.5">
    <Who login={person.login} src={Option.getOrUndefined(person.faceUrl)} />
    <span className="font-semibold text-ink">{person.login}</span>
  </span>
)

/**
 * Which issue this is, as a card rather than as loose text.
 *
 * The same shape as a pull request's header next door, and deliberately so: a
 * reader moving between the two screens should not have to find the number in a
 * different place. What differs is what an issue has — labels and assignees
 * where a pull request has branches and a diff size.
 */
export const IssueHeader = ({
  snapshot,
  onSettle,
  onReopen
}: {
  readonly snapshot: IssueSnapshot
  /** Closes the issue, saying why. Absent where nothing is wired up to it. */
  readonly onSettle?: (settling: Settled) => Effect.Effect<void, unknown>
  /** Opens a closed one again. */
  readonly onReopen?: () => Effect.Effect<void, unknown>
}) => (
  <section
    aria-label="This issue"
    className={`t-panel-fade mb-1.5 shrink-0 p-1 ${CARD}`}
  >
    <div className="mb-1 flex items-center gap-2.5">
      <TheState
        state={snapshot.state}
        word={wordOf(snapshot)}
        raisedAt={snapshot.openedAt}
      />

      <TheNumber of={snapshot.reference} />

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{snapshot.title}</h1>

      {/* At the far end of the line the state is on, which is the line it changes. A
          reader deciding whether to close an issue is reading the title and the word
          beside it, and the control belongs where that decision is being made. */}
      <Settle
        state={snapshot.state}
        where={snapshot.reference}
        allowed={snapshot.allowed}
        onSettle={onSettle}
        onReopen={onReopen}
      />
    </div>

    <div className="flex items-center gap-2 rounded-md bg-inset px-2.5 py-1.5 text-xs text-ink-muted">
      <Raiser person={snapshot.author} />

      {/* Wrapped rather than truncated. Labels are how a repository files its
          issues, and an issue with six of them is one where the sixth is as
          much of the filing as the first. */}
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {snapshot.labels.map((label) => (
          <Chip key={label.name} label={label} />
        ))}
      </span>

      {/* Faces and no words, at the far end where a pull request keeps its
          size. Nobody assigned is nothing at all rather than "Unassigned":
          most issues are, and the word would be on every one of them. */}
      {snapshot.assignees.length === 0 ? null : (
        <span className="ml-auto flex shrink-0 items-center" aria-label="Assigned to">
          {snapshot.assignees.map((person) => (
            <span key={person.login} className="-ml-1.5 rounded-full ring-2 ring-inset first:ml-0">
              <Who login={person.login} src={Option.getOrUndefined(person.faceUrl)} />
            </span>
          ))}
        </span>
      )}
    </div>
  </section>
)

/**
 * The same header, from the row the reader pressed rather than from the issue.
 *
 * Drawn for the seconds between the press and GitHub answering, which on the
 * first open of an issue is most of a page load: the read carries the issue and
 * every remark on it together, so a screen that waited for all of it showed a
 * reader nothing at all for two to four and a half seconds. A row already holds
 * the answer to what this is.
 *
 * Only what the row really carries. There is no description here and no
 * conversation, because a row has neither and the wait underneath is saying so.
 * There is no reason on a closed one, no assignees, and nothing to press: what a
 * reader may do to an issue is GitHub's answer and this row never asked for it,
 * so a Close button here would be a control that refuses the moment it is used.
 */
export const ListedHeader = ({ one }: { readonly one: ListedIssue }) => (
  <section
    aria-label="This issue"
    className={`t-panel-fade mb-1.5 shrink-0 p-1 ${CARD}`}
  >
    <div className="mb-1 flex items-center gap-2.5">
      {/* "Closed" and no more. GitHub's search says which of the two states an
          issue is in and never why it left the other, and "Closed as not
          planned" guessed over a read is the one sentence on this page a reader
          would act on. */}
      <TheState
        state={one.state}
        word={one.state === "open" ? "Open" : "Closed"}
        raisedAt={one.raisedAt}
      />

      <TheNumber of={one.reference} />

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{one.title}</h1>
    </div>

    <div className="flex items-center gap-2 rounded-md bg-inset px-2.5 py-1.5 text-xs text-ink-muted">
      <Raiser person={one.author} />

      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {one.labels.map((name) => (
          <LabelWord key={name} name={name} />
        ))}
      </span>
    </div>
  </section>
)

/**
 * A label as a row has it, which is the word and no colour.
 *
 * The dot is hashed from the word, exactly as the lists do it: see
 * `labelTone.ts`. GitHub's issue search answers with the names alone, and a
 * filled chip in a colour nobody read would change colour under the reader when
 * the issue lands. So the two forms are told apart on purpose: a dot while the
 * page is being read, GitHub's own fill once it has been.
 */
const LabelWord = ({ name }: { readonly name: string }) => (
  <span
    title={name}
    className="flex max-w-40 shrink-0 items-center gap-1.5 rounded-full bg-hover py-0.5 pr-2 pl-1.5 text-xs text-ink-muted"
  >
    <span
      aria-hidden="true"
      style={{ background: toneOf(name) }}
      className="size-1.5 shrink-0 rounded-full"
    />
    <span className="truncate">{name}</span>
  </span>
)
