/**
 * Live follow-up in a window that has no signed GitHub socket.
 *
 * The card's `watch` seam is the same one the extension fills with their page
 * socket. Here there is no page of theirs, so the follow-up is a poll: the
 * card is asked again on a timer, and a write that landed elsewhere shows up
 * without the reader pressing anything.
 */
export const POLL_MS = 15_000

export const pollUpdates = (
  _channels: ReadonlyArray<string>,
  onFire: () => void
): (() => void) => {
  const id = setInterval(onFire, POLL_MS)
  return () => {
    clearInterval(id)
  }
}
