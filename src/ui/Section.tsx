/**
 * A section of the column that says what this pull request is.
 *
 * All four look the same on purpose: a titled box with a line of summary in its
 * header, so the eye runs down one edge rather than learning four layouts. Its
 * own file for that reason: sameness across the panels is the point, and a
 * shell each panel could reach in and adjust would not stay the same for long.
 */
/**
 * What a section's title says before anything inside it is read.
 *
 * Four, and each one means exactly one thing. `bad` is broken — a red check, a
 * conflict — and it is the reason the others exist: a Court that says the reader
 * is holding a pull request up cannot be painted the same red as a pull request
 * that is on fire, because a row can be both at once and a reader who cannot
 * tell them apart has to open every one to find out which.
 */
import { type ArtName, useArt } from "./art"
import { CARD, CARD_HEAD } from "./dress"

export type Tone = "plain" | "bad" | "attention" | "done"

const TITLE: Record<Tone, string> = {
  plain: "",
  bad: "text-fail",
  attention: "text-busy",
  done: "text-done"
}

/**
 * The edge and the header a tone paints, for the skeleton that waits in a
 * section's place. Exported so the two cannot drift: a Court that waits in one
 * colour and arrives in another is a flicker of colour where nothing changed.
 */
export const painted = (tone: Tone): { readonly edge: string; readonly header: string; readonly title: string } => ({
  edge: CARD,
  header: CARD_HEAD,
  title: TITLE[tone]
})

/** A header's glyph, hidden from a reader who is being read to: the name is beside it. */
const Mark = ({ art }: { readonly art: ArtName }) => {
  const set = useArt()
  const Glyph = set[art]

  return <Glyph size={14} aria-hidden="true" className="shrink-0 opacity-80" />
}

export const Section = ({
  name,
  heading,
  summary,
  art,
  aside,
  tone = "plain",
  children
}: {
  readonly name: string
  /**
   * What the header shows in place of the name, where the name is also somewhere
   * to go.
   *
   * Activity heads each card with the repository it happened in, and that address
   * is a link. The label a screen reader announces stays `name` either way, so a
   * card cannot end up announced as whatever markup its title happens to be.
   */
  readonly heading?: React.ReactNode
  readonly summary?: React.ReactNode
  /**
   * The glyph on the header, which says what kind of answer this box holds before the
   * words are read.
   *
   * Optional, and it takes the header's own ink rather than a colour of its own: the tone
   * has already said whether this is the reader's move, and a glyph in a second colour
   * would be the same sentence twice in two voices.
   */
  readonly art?: ArtName
  /**
   * Somewhere to go from the header, at the far end of it.
   *
   * For a card that shows part of something and has the whole of it one press away. It
   * is the header rather than a line under the last row because a reader who has decided
   * this is the card they want has not read to the bottom of it.
   */
  readonly aside?: React.ReactNode
  readonly tone?: Tone
  readonly children: React.ReactNode
}) => (
  <section
    aria-label={name}
    // Never shrunk: a flex child left to its own devices gives up its height to
    // its neighbours, which is how opening the description once squashed CI and
    // the conversation into two bars.
    //
    // Painted rather than left to whatever is behind it. In the window that was
    // harmless — the page under a card is our canvas either way — but on
    // github.com it meant a light pack drew light-theme ink onto GitHub's dark
    // page, and the description could not be read. A card carries its own
    // floor; the space between cards is still the site's.
    className={`shrink-0 overflow-hidden ${CARD}`}
  >
    <div className={CARD_HEAD}>
      {art === undefined ? null : <Mark art={art} />}
      <h2 className={`min-w-0 truncate text-xs font-semibold ${TITLE[tone]}`}>{heading ?? name}</h2>
      {summary === undefined ? null : (
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{summary}</span>
      )}
      {aside === undefined ? null : <div className="ml-auto shrink-0">{aside}</div>}
    </div>
    {children}
  </section>
)
