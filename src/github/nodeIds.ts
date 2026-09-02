import { Option } from "effect"

/**
 * The number inside one of GitHub's global node ids.
 *
 * Their rows name a pull request by node id now — `PR_kwDOSqzG5M8AAAABB4wjtw`
 * rather than `4421591991` — and one route did not move with them. The deferred
 * read, which is where the checks and the review decision come from, still takes
 * the number: asked with the node ids off its own rows it answers 200 and no
 * results at all, and asked with the numbers inside them it answers every row.
 * It then names each answer by node id again, which is the key the rows are held
 * under, so nothing has to be turned back afterwards.
 *
 * Recorded against a live dashboard on 2026-09-02, five rows off
 * `waiting-for-review`: node ids gave `results: []`, the same five decoded gave
 * five rows carrying `statusCheckRollup` and `reviewDecisionState`.
 *
 * The encoding is base64url after the type prefix, holding MessagePack for
 * `[0, repository id, pull request id]`: `0x93` opens an array of three and
 * `0x00` is the zero. Each id that follows carries its own width tag, and both
 * widths are in circulation — `0xce` for four bytes, `0xcf` for eight. A pull
 * request opened years ago is `PR_kwDOAn8RLM5O2iyL`, twelve bytes with a
 * four-byte id; one opened this year is `PR_kwDOSqzG5M8AAAABB4wjtw`, sixteen
 * with an eight-byte one. Reading only the wide form dropped every older row,
 * silently, into a list with no checks on it.
 *
 * Anything shaped otherwise answers none rather than a wrong number, because a
 * wrong number here is a row wearing somebody else's checks.
 */
export const numberInNodeId = (nodeId: string): Option.Option<number> => {
  /*
   * Split once, and only once.
   *
   * The prefix is the only thing that says which kind this is: an issue's id packs
   * exactly the same way, and asking the deferred route about an issue's number is
   * asking about a different object that happens to have one.
   *
   * And the body is base64url, where `_` is what `/` becomes — so
   * `PR_kwDOAn8RLM8AAAABB4_xTA` has one inside it. Splitting on every underscore
   * kept `kwDOAn8RLM8AAAABB4` and threw the rest away, which decoded to nothing and
   * dropped that row's checks without a word.
   */
  const at = nodeId.indexOf("_")
  if (at === -1) return Option.none()
  const kind = nodeId.slice(0, at)
  const packed = nodeId.slice(at + 1)
  if (kind !== "PR" || packed === "") return Option.none()

  const bytes = bytesOf(packed)
  if (bytes === null) return Option.none()
  if (bytes[0] !== 0x93 || bytes[1] !== 0x00) return Option.none()

  const repository = fieldAt(bytes, 2)
  if (repository === null) return Option.none()
  const pull = fieldAt(bytes, repository.next)
  // Nothing after the pull request's id, or this is some other shape that happens
  // to open the same way.
  if (pull === null || pull.next !== bytes.length) return Option.none()

  return Number.isSafeInteger(pull.value) && pull.value > 0
    ? Option.some(pull.value)
    : Option.none()
}

/**
 * One unsigned integer and where the next field starts, or nothing.
 *
 * Read as a plain number rather than a bigint: their ids are ten digits, so even
 * the wide form is far inside what a double holds exactly, and a bigint here
 * would only have to be turned back into a string to be sent.
 */
const fieldAt = (
  bytes: Uint8Array,
  at: number
): { readonly value: number; readonly next: number } | null => {
  const width = bytes[at] === 0xce ? 4 : bytes[at] === 0xcf ? 8 : 0
  if (width === 0 || at + 1 + width > bytes.length) return null

  let value = 0
  for (let step = 0; step < width; step++) value = value * 256 + (bytes[at + 1 + step] ?? 0)
  return { value, next: at + 1 + width }
}

/** The base64url alphabet, and nothing else. */
const BASE64URL = /^[A-Za-z0-9_-]+$/

/**
 * Base64url to bytes, or nothing where it is not base64url at all.
 *
 * Checked before decoding rather than caught after. `atob` throws on a character
 * it does not know and on a length no padding can fix, and this is fed whatever
 * GitHub put in a field — so the question is asked of the string, where it has an
 * answer, rather than of an exception.
 *
 * A length of one past a multiple of four is the one no padding fixes: base64
 * carries six bits a character, and a single leftover character is fewer bits
 * than a byte.
 */
const bytesOf = (packed: string): Uint8Array | null => {
  if (!BASE64URL.test(packed) || packed.length % 4 === 1) return null

  const base64 = packed.replaceAll("-", "+").replaceAll("_", "/")
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (letter) => letter.charCodeAt(0))
}

/**
 * The numbers for a batch of rows, dropping any this cannot read.
 *
 * Dropping rather than failing, because one unreadable id is one row without its
 * checks and the rest of the list is still worth having. An empty answer means
 * nothing to ask about, which the caller reads as no request to make.
 */
export const numbersInNodeIds = (ids: ReadonlyArray<string>): ReadonlyArray<number> =>
  ids.flatMap((id) => Option.match(numberInNodeId(id), { onNone: () => [], onSome: (n) => [n] }))
