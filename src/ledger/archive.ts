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
 * The files an uncompressed tar holds, by their path in the repository.
 *
 * Only what a reader could open: ordinary files, and not the directories, the
 * links, or the long-name extensions GNU tar writes for paths past a hundred
 * characters. A `pax` or `longlink` entry names the file *after* it, and the
 * name in the header of that one is truncated — so both are skipped along with
 * the file they describe rather than filed under a name that is wrong.
 */
export const filesIn = (bytes: Uint8Array): Held => {
  const held = new Map<string, string>()
  let at = 0
  let skipNext = false

  while (at + BLOCK <= bytes.length) {
    const name = field(bytes, at, 100)
    // Two empty blocks end an archive, and a run of zeroes is how that is
    // written. An entry with no name is the end whether or not the second block
    // is there.
    if (name === "") break

    const size = Number.parseInt(field(bytes, at + 124, 12), 8) || 0
    const kind = String.fromCharCode(bytes[at + 156] ?? 0)
    const from = at + BLOCK
    // Content is padded to the next block boundary.
    at = from + Math.ceil(size / BLOCK) * BLOCK

    if (kind === "L" || kind === "x" || kind === "g") {
      skipNext = true
      continue
    }
    if (skipNext) {
      skipNext = false
      continue
    }
    // `0` and a NUL byte both mean an ordinary file; everything else is a
    // directory, a link, or something no reader opens.
    if (kind !== "0" && kind !== " ") continue

    const path = under(name)
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
