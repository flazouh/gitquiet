/**
 * The wait, in the one form it takes everywhere.
 *
 * This used to be a skeleton: the whole page drawn as bars, every panel and every
 * line of the diff in the place its content would land. It was a good answer to a
 * question this extension no longer asks. Lists open from memory and pull requests
 * are read ahead on the way to them, so the wait a reader actually meets is short,
 * and rarely the whole page — a page-sized guess in front of a card that is one
 * read away spends its time being wrong in more places.
 *
 * What is left says the true thing plainly: something is being read, this is what
 * it is, and it is still going. A circle that turns, a line that catches light,
 * and the name of the thing underneath it.
 */

/**
 * The circle.
 *
 * An arc over a ring rather than a whole spinning O, so the turn is legible at
 * twenty pixels — a uniform circle rotating looks like a circle standing still.
 * `t-rotate` is GitHub's own second, which is also what their check spinners
 * turn at, so two of these side by side keep time.
 */
const Circle = () => (
  <svg viewBox="0 0 24 24" className="t-rotate size-5 shrink-0" aria-hidden focusable="false">
    <circle
      cx="12"
      cy="12"
      r="9.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="opacity-20"
    />
    <path
      d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
)

export type WaitingProps = {
  /** What is being read, as a sentence. Shown, and read aloud. */
  readonly what: string
  /**
   * The thing itself, named: `owner/repo #1234`, or a repository.
   *
   * Second and dimmer because it answers a question the reader already knows the
   * answer to — they pressed it — and its job is to confirm the wait belongs to
   * what they pressed rather than to something they left behind.
   */
  readonly detail?: string
  /** True once what was being read is on the page underneath, and this is going. */
  readonly leaving?: boolean
  /**
   * How much room to hold.
   *
   * A card fills the window and a list is a column near the top of it, and a wait
   * centred in the wrong one of those is a wait the reader has to go looking for.
   */
  readonly room?: "card" | "list"
}

const ROOM: Readonly<Record<"card" | "list", string>> = {
  /*
   * The window, not the region the card will land in.
   *
   * A box of its own inside the region is centred on the region, and the region
   * starts wherever GitHub's header ends — so the wait came out a little above the
   * middle of the screen, which is the one place the eye does not look for it. How
   * much of the window their header has taken is their decision and it moves with a
   * banner, so this stops trying to answer that question and centres on the window
   * the reader is actually looking at.
   *
   * Out of the flow from the first frame, so nothing shifts when the card arrives
   * underneath. Nothing here can be pressed, and for the moment it covers the page
   * it must not stand between the reader and what can be — GitHub's header is still
   * theirs while this is up.
   */
  card: "t-over-window pointer-events-none fixed inset-0",
  list: "min-h-[18rem]"
}

export const Waiting = ({ what, detail, leaving = false, room = "card" }: WaitingProps) => (
  <div
    // The one contract the rest of the extension reads off the wait: the page has
    // not been read yet. The click benchmark keys on it to decide when a reader
    // could start reading, and so does every measurement taken since.
    data-gitquiet-loading=""
    data-leaving={leaving ? "" : undefined}
    className={`t-waiting flex flex-col items-center justify-center gap-3 ${ROOM[room]}`}
  >
    <span className="text-ink-accent">
      <Circle />
    </span>

    {/* Spoken as well as shown, which the bars could only ever be spoken. */}
    <p role="status" className="t-shimmer text-sm font-medium">
      {what}
    </p>

    {detail === undefined ? null : (
      <p className="font-mono text-xs text-ink-muted" aria-hidden>
        {detail}
      </p>
    )}
  </div>
)

/**
 * A list that has been read, waiting on a filter rather than on GitHub.
 *
 * Not a {@link Waiting}, deliberately, and not only because it is smaller: this
 * page has been read, so it must not carry the attribute that says otherwise —
 * the click benchmark reads that attribute to decide when a reader could start
 * reading, and a filtered list claiming to be unread would quietly ruin every
 * measurement of it.
 */
export const StillReading = ({ what }: { readonly what: string }) => (
  <p role="status" className="t-shimmer px-3 py-2 text-sm">
    {what}
  </p>
)
