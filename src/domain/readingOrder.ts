/**
 * The files around the open one, in the order they are likely to be wanted.
 *
 * Forward first: reviewing a pull request is walking down the list, and Next is
 * the button being pressed. Then backwards over what was already passed, since
 * the second most common move is going back to check something. The open file
 * is not in here — whoever is reading it already asked for it.
 *
 * A list of what to fetch and in what order, and nothing about fetching: the
 * library takes this and works out how many requests it is.
 */
export const readingOrder = (
  paths: ReadonlyArray<string>,
  at: number
): ReadonlyArray<string> => {
  const from = at < 0 ? -1 : at

  const ahead = paths.slice(from + 1)
  const behind = paths.slice(0, Math.max(from, 0)).reverse()

  return [...ahead, ...behind]
}
