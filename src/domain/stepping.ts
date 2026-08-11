/**
 * Where one press of Next or Previous lands, counting round the ends.
 *
 * A review is a loop rather than a line: the last file is next to the first,
 * and someone holding `j` down to spin through forty files should come back
 * round to the top rather than stop dead at the bottom with no sign of why.
 * Stopping was the earlier answer here, on the grounds that a reader who
 * wrapped would not know where they were — but the file name is on the screen
 * the whole time, so they do.
 *
 * A count and a position rather than the list itself, because nothing about
 * this needs to know what is being stepped through. Below one item there is
 * nowhere to go and it says so with an index no list has, which is what the
 * caller was going to be handed for any answer at all.
 */
export const stepping = (count: number, at: number, by: number): number =>
  count <= 0 ? -1 : (((at + by) % count) + count) % count
