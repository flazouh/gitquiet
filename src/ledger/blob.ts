/**
 * What git calls a file's contents.
 *
 * `sha1("blob " + length + "\0" + contents)`, which is the name git gives a
 * blob and the name GitHub's own tree answers with. Any hash would key a Ledger,
 * and this one is worth the same work because it is the name the rest of the
 * world already uses for these bytes: a file that has not changed between two
 * commits has one of these, and a Ledger keyed by it reads that file once for
 * both.
 *
 * SHA-1 is not being asked to be a security boundary here. It is git's name for
 * a file and is used as a name.
 */

import { Effect } from "effect"

const utf8 = new TextEncoder()

const HEX = "0123456789abcdef"

const written = (bytes: Uint8Array): string => {
  let hex = ""
  for (const byte of bytes) {
    hex += (HEX[byte >> 4] ?? "") + (HEX[byte & 15] ?? "")
  }
  return hex
}

/**
 * The blob sha of one file's text.
 *
 * The length in the header is the length in *bytes* and not in characters,
 * which for anything with an accent or an emoji in it are different numbers —
 * and a header with the wrong length hashes to something git has never heard of.
 */
export const blobSha = (text: string): Effect.Effect<string, unknown> =>
  Effect.gen(function* () {
    const body = utf8.encode(text)
    const header = utf8.encode(`blob ${body.length}\0`)

    const whole = new Uint8Array(header.length + body.length)
    whole.set(header, 0)
    whole.set(body, header.length)

    const digest = yield* Effect.tryPromise({
      try: () => crypto.subtle.digest("SHA-1", whole as BufferSource),
      catch: (cause) => cause
    })
    return written(new Uint8Array(digest))
  })
