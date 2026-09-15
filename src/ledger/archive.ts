/**
 * A repository at one commit, out of the archive GitHub already serves.
 *
 * `https://github.com/{owner}/{repo}/archive/{sha}.tar.gz` is one request for
 * every file, which is the alternative to one request per file followed. It is
 * the address their own download button uses, it redirects to `codeload` with a
 * signed token, and so it reaches a private repository on the session this
 * extension already has.
 *
 * Nothing here is WebAssembly and nothing here is a dependency. `gzip` is a
 * stream the browser has had for years, and `tar` is a header every 512 bytes —
 * a format from 1979 that has the decency to still be simple.
 */

import { Effect } from "effect"

/** One file out of an archive: its path with the top folder taken off, and its text. */
export type Held = ReadonlyMap<string, string>

/** Every tar header is 512 bytes, and so is every block of content. */
const BLOCK = 512

const text = new TextDecoder()

/** A NUL-terminated field, as tar writes them. */
const field = (bytes: Uint8Array, from: number, size: number): string => {
  const slice = bytes.subarray(from, from + size)
  const end = slice.indexOf(0)
  return text.decode(end === -1 ? slice : slice.subarray(0, end)).trim()
}

/**
 * Where the archive's own top folder ends.
 *
 * GitHub wraps everything in `{repo}-{sha}/`, so every path in the archive has a
 * folder in front of it that is not in the repository. Taken off by counting to
 * the first slash rather than by knowing the repository's name, which the caller
 * would otherwise have to pass in and could get wrong.
 */
const under = (path: string): string => path.slice(path.indexOf("/") + 1)

/**
 * The whole path of an entry, out of the two fields `ustar` splits it across.
 *
 * The name field is a hundred bytes and a monorepo does not fit in it. GitHub
 * wraps an archive in `{repo}-{sha}/`, which for a forty-character sha is 56
 * characters spent before any of the repository's own path has been counted —
 * so `ustar` puts the leading folders in a second field and the tail in the
 * first, and a reader of only the first gets `index.ts` where the file is
 * `services/cfw-intern-api/src/routes/vault/index.ts`.
 *
 * Measured on this repository at one commit: 31,767 of its 36,613 files are
 * written that way. Reading the name alone filed all of them under a path the
 * repository does not have, thousands of them under the same one — so a name
 * used in another file was a name used nowhere, and the panel that says who
 * depends on this said nobody.
 *
 * Only for `ustar`. Old GNU tar writes its own thing in those bytes, and a
 * prefix read off one of those archives would be an invention.
 */
const whole = (bytes: Uint8Array, at: number): string => {
  const name = field(bytes, at, 100)
  if (field(bytes, at + 257, 6) !== "ustar") return name

  const prefix = field(bytes, at + 345, 155)
  return prefix === "" ? name : `${prefix}/${name}`
}

/**
 * The path a pax extended header states, out of its records.
 *
 * Written as `len key=value\n`, where `len` counts its own digits, the space
 * and the newline. Only `path` is wanted here; the rest is times and ownership
 * nothing in this extension reads.
 */
const stated = (body: string): string | null => {
  let at = 0
  while (at < body.length) {
    const space = body.indexOf(" ", at)
    if (space === -1) return null

    const long = Number.parseInt(body.slice(at, space), 10)
    // A length that is not a number, or that would not move, is a header this
    // does not understand — and walking it anyway is an endless loop.
    if (!Number.isInteger(long) || long <= 0) return null

    const record = body.slice(space + 1, at + long).replace(/\n$/, "")
    const is = record.indexOf("=")
    if (is !== -1 && record.slice(0, is) === "path") return record.slice(is + 1)
    at += long
  }
  return null
}

/**
 * The files an uncompressed tar holds, by their path in the repository.
 *
 * Only what a reader could open: ordinary files, and not the directories or
 * the links.
 *
 * A path too long for either field is stated by a header of its own, in front
 * of the entry it describes — GNU writes an `L` whose body is the path, pax
 * writes an `x` whose body holds a `path=` record. Both used to be skipped
 * along with the file they name, which filed nothing under a path that was
 * merely long. Both are now read, and the path they state wins over the header
 * of the entry itself, which is the truncated copy they exist to correct.
 */
export const filesIn = (bytes: Uint8Array): Held => {
  const held = new Map<string, string>()
  let at = 0
  /** The path the header before this one stated, for the entry it describes. */
  let said: string | null = null

  while (at + BLOCK <= bytes.length) {
    const head = at
    const name = field(bytes, head, 100)
    // Two empty blocks end an archive, and a run of zeroes is how that is
    // written. An entry with no name is the end whether or not the second block
    // is there.
    if (name === "") break

    const size = Number.parseInt(field(bytes, head + 124, 12), 8) || 0
    const kind = String.fromCharCode(bytes[head + 156] ?? 0)
    const from = head + BLOCK
    // Content is padded to the next block boundary.
    at = from + Math.ceil(size / BLOCK) * BLOCK

    // A global header describes the archive and not the entry after it, so it
    // is the one of the three that takes nothing with it. GitHub puts one
    // first, and skipping the entry behind it skipped whatever came first.
    if (kind === "g") continue

    if (kind === "L" || kind === "x") {
      const body = text.decode(bytes.subarray(from, from + size))
      said = kind === "L" ? (body.split("\0")[0] ?? null) : stated(body)
      continue
    }

    const full = said ?? whole(bytes, head)
    // Spent, whatever the entry turned out to be: a long name in front of a
    // directory belongs to that directory, and carrying it on to the next file
    // would file that file under the folder's name.
    said = null

    // `0` and a NUL byte both mean an ordinary file; everything else is a
    // directory, a link, or something no reader opens.
    if (kind !== "0" && kind !== " ") continue

    const path = under(full)
    if (path === "") continue
    held.set(path, text.decode(bytes.subarray(from, from + size)))
  }

  return held
}

/**
 * The archive's bytes, ungzipped, without a library.
 *
 * `DecompressionStream` is the browser's own and has been since Chrome 80. It
 * is not WebAssembly, so unlike everything else the Ledger does this could have
 * happened on the page — it does not, because the bytes are wanted where the
 * parsing is.
 */
export const unzipped = (packed: ReadableStream): Effect.Effect<Uint8Array, unknown> =>
  Effect.tryPromise({
    try: () =>
      new Response(packed.pipeThrough(new DecompressionStream("gzip")) as BodyInit).arrayBuffer(),
    catch: (cause) => cause
  }).pipe(Effect.map((whole) => new Uint8Array(whole)))
