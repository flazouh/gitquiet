import type { Effect } from "effect"
import { Option } from "effect"
import type { Closing, IssueSnapshot, Label, Settled } from "../domain/Issue"
import { issueName, useArt } from "./art"
import { CHIP } from "./dress"
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
}) => {
  const art = useArt()
  const Art = art[issueName(snapshot.state)]
  const word = wordOf(snapshot)
  const age = ageOf(snapshot.openedAt)

  return (
    <section
      aria-label="This issue"
      className="t-panel-fade mb-1.5 shrink-0 rounded-md border border-line bg-surface p-1"
    >
      <div className="mb-1 flex items-center gap-2.5">
        <span
          aria-label={`${word} ${age}`}
          /*
           * Said out loud when it changes, which is the third fault in the thread on GitHub's
           * own close button: theirs shows the reason as a coloured glyph, and a screen reader
           * is never told the issue closed at all. The word is here anyway, so announcing it
           * costs one attribute.
           */
          aria-live="polite"
          title={`Opened ${momentOf(snapshot.openedAt)}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
            snapshot.state === "open"
              ? "bg-pass-emphasis text-ink-on-emphasis"
              : "bg-done-emphasis text-ink-on-emphasis"
          }`}
        >
          <Art size={12} />
          {word}
          <span className="font-normal opacity-80 tabular-nums">{age}</span>
        </span>

        <span
          className={`${CHIP} shrink-0 font-mono text-base font-semibold tabular-nums text-ink`}
        >
          {`#${snapshot.reference.number}`}
        </span>

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
        <span className="flex shrink-0 items-center gap-1.5">
          <Who login={snapshot.author.login} src={Option.getOrUndefined(snapshot.author.faceUrl)} />
          <span className="font-semibold text-ink">{snapshot.author.login}</span>
        </span>

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
}
