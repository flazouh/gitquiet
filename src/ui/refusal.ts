/**
 * What GitHub said, out of whatever the failure arrived wrapped in.
 *
 * The gateway's own error carries the sentence from their answer; anything else
 * is a network fault, and saying so plainly beats printing an object.
 *
 * Its own module because two places now put a refusal in front of a reader —
 * the merge card, where a button was pressed, and the list, where a row's menu
 * was — and both are repeating the same sentence for the same reason.
 */
export const reasonFor = (cause: unknown): string => {
  const failed = cause as { detail?: unknown; reason?: unknown }

  // The detail on an unreachable call is the thrown value, kept so a log can
  // carry it. A reader got it verbatim and read "TypeError: Failed to fetch"
  // beside the button they had just pressed, on this card and on the merge
  // card's Convert to draft, which is every write there is.
  if (failed?.reason === "unreachable") return "GitHub could not be reached."

  const detail = failed?.detail
  if (typeof detail === "string" && detail.length > 0) return detail
  return "GitHub could not be reached."
}
