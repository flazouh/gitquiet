import { SpinnerIcon } from "./spinner"

/**
 * What a button says, holding room for everything it can say.
 *
 * A control that asks GitHub for something has more than one word in it: the verb
 * at rest, "Confirm" where the press is asked for twice, the verb in flight, and
 * what GitHub agreed to. Written straight into the button, each of those is a box
 * of a different width — so a press moved the target under the reader's pointer,
 * and on the merge card's wrapping row it moved the two buttons beside it as well.
 * Every word stands in one grid cell instead, which makes the box as wide as the
 * widest of them from the first frame and the same width for the rest of its life.
 *
 * The circle rides in front of the word that is a wait, and its room is part of
 * that word rather than of the button: a slot held by every state would leave a
 * resting verb sitting behind eighteen pixels of nothing. Held all the same, so
 * the cell is already as wide as the pair — the circle arrives into space that was
 * there, which is the difference between this and a button that grows a spinner.
 *
 * `docs/spec/stack-preview.md` settles the same question the other way for a row
 * of a stack, and both answers follow from what is around the thing: a row stands
 * at the leading edge of a strip as wide as the page, so a count arriving lands in
 * space no row was using. A button is a target, and there is no free space inside
 * one.
 *
 * Only the word being said is announced. The rest carry `aria-hidden`, which is
 * also what the sheet reads to decide which of them is at rest and which are
 * waiting off the cell — a word nobody can see and a word nobody is told about are
 * the same word.
 */
export const Says = ({
  among,
  said,
  waiting
}: {
  /**
   * Every word this button can say, in the order a press says them.
   *
   * The order is the direction they travel: a word already passed leaves upward
   * and the next arrives from below, so the whole press reads as one carousel
   * rather than as words appearing in place of each other.
   */
  readonly among: ReadonlyArray<string>
  /** The one it is saying now, which is one of the above. */
  readonly said: string
  /** The one that means GitHub is being asked, if this button has such a word. */
  readonly waiting?: string
}) => {
  const now = among.indexOf(said)

  return (
    <span className="t-says">
      {among.map((word, at) => (
        <span
          key={word}
          className="t-say inline-flex items-center gap-1.5 whitespace-nowrap"
          aria-hidden={word === said ? undefined : true}
          data-past={at < now ? "" : undefined}
        >
          {word === waiting ? (
            // Never named, in either state. The circle is drawn for a running
            // check as well, where nothing else says so and it carries its own
            // name; on a button the word beside it has already said it, and a
            // second name would call this one "Running Merging…".
            <span data-room="" aria-hidden="true" className="flex size-3 shrink-0">
              {word === said ? <SpinnerIcon size={12} /> : null}
            </span>
          ) : null}
          {word}
        </span>
      ))}
    </span>
  )
}
