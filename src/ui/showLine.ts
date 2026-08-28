/**
 * Puts one line of a drawn diff on the screen, and says whether it found it.
 *
 * The diff is drawn into a shadow root by a renderer that is not ours, so the
 * row is found by the attribute that renderer writes on every line it draws —
 * `data-line`, which is the line's own number and not its index. Its own module
 * rather than a helper inside the pane, so the one assumption this interface
 * makes about somebody else's markup is a file with its name on it — and so the
 * half that is ours can be tested without the renderer, which is a built
 * artefact no test here has.
 *
 * A miss is an answer rather than a throw. A line named in an address may be
 * past the end of a file that has since changed, or inside a hunk this diff does
 * not show, and neither is a reason to do anything but leave the reader at the
 * top of the file they asked for.
 */
export const showLine = (within: ParentNode | null, line: number): boolean => {
  const row = within?.querySelector(`[data-line="${line}"]`) ?? null
  if (!(row instanceof HTMLElement)) return false

  row.scrollIntoView({ block: "center" })
  return true
}

/** Long enough for the draw the line is inside of, in milliseconds. */
export const DRAWING = 2_000
