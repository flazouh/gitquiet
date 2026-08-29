/**
 * What the reader wrote, less whatever the read already carries.
 *
 * A comment has to appear where it was written, and re-reading the whole page to
 * find the one comment the reader is holding is a second of nothing happening.
 * So what they wrote is kept beside what GitHub said and drawn after it.
 *
 * Kept, but only ever added to, which is the fault this exists for. A read
 * arrives behind every write, and again every time the reader comes back to the
 * tab, and it carries the comment they wrote — so the comment was drawn twice,
 * under an id React had already used. Once the read has it, the copy held here
 * has nothing left to say.
 */
export const beyond = <Written extends { readonly id: string }>(
  known: ReadonlyArray<Written>,
  ours: ReadonlyArray<Written>
): ReadonlyArray<Written> => {
  if (ours.length === 0) return ours

  const already = new Set(known.map((one) => one.id))
  return ours.filter((one) => !already.has(one.id))
}
