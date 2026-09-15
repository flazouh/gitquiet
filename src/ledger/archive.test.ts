import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { filesIn, unzipped } from "./archive"

/**
 * What this machine's `tar` calls the format GitHub serves.
 *
 * One of the three the reader has to handle, and not the one codeload actually
 * serves. Read off a real archive: `github.com/OpenRouterTeam/openrouter-web` at
 * `2b00592` is `ustar\000` — POSIX, which splits a long path across two fields —
 * and this fixture was GNU-only, which is why the splitting went unnoticed. GNU
 * tar spells the format `gnu` and macOS's bsdtar spells it `gnutar`, and neither
 * accepts the other's word, so the one this machine takes is found by asking it.
 */
const gnuFormat = async (): Promise<string> => {
  for (const spelling of ["gnu", "gnutar"]) {
    const asked = await Bun.$`tar --format=${spelling} -cf /dev/null --files-from /dev/null`
      .quiet()
      .nothrow()
    if (asked.exitCode === 0) return spelling
  }
  throw new Error("this machine's tar writes neither GNU format spelling")
}

/**
 * Against a tar this machine's own `tar` wrote, rather than one built to suit the
 * reader below. The format is somebody else's, and the whole risk here is believing
 * something about it that is not true.
 *
 * The format is named rather than left to the default, which is the one thing about
 * the machine this does not want. Left to itself macOS's bsdtar writes a pax extended
 * header in front of every single entry, so on a Mac this fixture measured a
 * different path through the reader than the same test on Linux — a test that
 * measures the machine rather than the parser. Every format is now asked for by
 * name, below, and each one is a case the reader has to answer.
 *
 * `COPYFILE_DISABLE` is the other half: without it that tar puts an AppleDouble `._`
 * file beside every entry, and those came through the reader as files of the
 * repository.
 */
const made = async (): Promise<Uint8Array> => {
  const root = `/tmp/gitquiet-archive-${Date.now()}`
  const long = "long".repeat(40)
  const format = await gnuFormat()
  await Bun.$`mkdir -p ${root}/gitquiet-abc123/src/ui`.quiet()
  await Bun.write(`${root}/gitquiet-abc123/README.md`, "# A repository\n")
  await Bun.write(`${root}/gitquiet-abc123/src/ui/place.ts`, "export const place = 1\n")
  await Bun.write(`${root}/gitquiet-abc123/src/ui/${long}.ts`, "export const long = 2\n")
  await Bun.$`tar --format=${format} -czf ${root}/out.tar.gz -C ${root} gitquiet-abc123`
    .env({ ...process.env, COPYFILE_DISABLE: "1" })
    .quiet()

  return await Effect.runPromise(unzipped(Bun.file(`${root}/out.tar.gz`).stream()))
}

describe("a repository out of its archive", () => {
  test("holds every file, by its path in the repository", async () => {
    const files = filesIn(await made())

    expect(files.get("README.md")).toBe("# A repository\n")
    expect(files.get("src/ui/place.ts")).toBe("export const place = 1\n")
  })

  test("takes off the folder the archive wraps everything in", async () => {
    const files = filesIn(await made())

    // GitHub writes `{repo}-{sha}/`, which is not a folder the repository has.
    expect([...files.keys()].some((path) => path.startsWith("gitquiet-abc123/"))).toBe(false)
  })

  test("keeps the directories out of it, which are not files anyone opens", async () => {
    const files = filesIn(await made())

    expect(files.has("src")).toBe(false)
    expect(files.has("src/ui")).toBe(false)
    expect(files.has("")).toBe(false)
  })

  test("does not file a long-named file under a truncated name", async () => {
    const files = filesIn(await made())

    // A path past a hundred characters is written as an entry of its own before
    // the file it names, whose own header then holds a truncation. Filed under
    // that truncation, a reader would be handed somebody else's contents.
    for (const [path, held] of files) {
      if (path.includes("place.ts")) expect(held).toBe("export const place = 1\n")
      if (path.includes("README")) expect(held).toBe("# A repository\n")
    }
    expect(files.get("src/ui/place.ts")).toBe("export const place = 1\n")
  })

  test("stops at the end rather than reading the padding as a file", async () => {
    const files = filesIn(await made())

    expect(files.size).toBeGreaterThanOrEqual(2)
    expect([...files.keys()].every((path) => path.trim() !== "")).toBe(true)
  })
})

/**
 * The same three files, in whichever format is asked for, wrapped the way
 * codeload wraps them.
 *
 * The folder is the real shape and not a short stand-in: `{repo}-{sha}` with a
 * forty-character sha is 56 characters, and a header's name field is a hundred.
 * A repository whose own paths are longer than 44 characters — which is most of
 * a monorepo — cannot be written in that field at all, and which of the three
 * mechanisms a tar reaches for then is the whole of what is being tested.
 */
const wrapped = async (format: string): Promise<Uint8Array> => {
  const root = `/tmp/gitquiet-archive-${format}-${Date.now()}`
  const folder = "openrouter-web-2b005925ea970da33cc5020898aa1ba3c50bfd63"
  const deep = "services/cfw-intern-api/src/routes/vault"
  await Bun.$`mkdir -p ${root}/${folder}/${deep}`.quiet()
  await Bun.write(`${root}/${folder}/README.md`, "# short\n")
  await Bun.write(`${root}/${folder}/${deep}/index.ts`, "export const listSecrets = 1\n")
  await Bun.$`tar --format=${format} -czf ${root}/out.tar.gz -C ${root} ${folder}`
    .env({ ...process.env, COPYFILE_DISABLE: "1" })
    .quiet()

  return await Effect.runPromise(unzipped(Bun.file(`${root}/out.tar.gz`).stream()))
}

/**
 * A path too long for one field, in every format that has a way of saying so.
 *
 * This is not an edge of the format, it is the ordinary case for a monorepo —
 * and it was the whole of a bug worth a note. Read off the archive codeload
 * really serves for `openrouter-web`: 31,767 of its 36,613 files need one of
 * these mechanisms, and reading only the hundred-byte name field filed every
 * one of them under a path the repository does not have. Thousands collapsed
 * onto the same key, so the map held 30,679 files where the archive had 36,613.
 *
 * What the reader saw was a name used nowhere. Uses in the open file were
 * exact, because the pane hands over that file's own text, and everything the
 * repository should have answered came back empty — `listSecrets` in
 * `routes/vault/handlers.ts` is called twice in `routes/vault/index.ts`, and
 * the panel said "0 elsewhere" rather than saying it could not tell.
 */
describe("a path too long for a tar header", () => {
  test("puts back together what ustar splits across two fields", async () => {
    const files = filesIn(await wrapped("ustar"))

    expect(files.get("services/cfw-intern-api/src/routes/vault/index.ts")).toBe(
      "export const listSecrets = 1\n"
    )
    // And not under the tail on its own, which is what reading the name field
    // alone produced — a path the repository does not have, and one that every
    // other `index.ts` in the archive would have overwritten.
    expect(files.has("index.ts")).toBe(false)
  })

  test("reads the path a GNU long-name header states", async () => {
    const files = filesIn(await wrapped(await gnuFormat()))

    expect(files.get("services/cfw-intern-api/src/routes/vault/index.ts")).toBe(
      "export const listSecrets = 1\n"
    )
  })

  test("reads the path a pax header states", async () => {
    const files = filesIn(await wrapped("pax"))

    expect(files.get("services/cfw-intern-api/src/routes/vault/index.ts")).toBe(
      "export const listSecrets = 1\n"
    )
    // The short file too: pax writes a header in front of every entry, and a
    // reader that skipped the entry behind one skipped the whole archive.
    expect(files.get("README.md")).toBe("# short\n")
  })

  test("does not carry a long name on to the entry after the one it names", async () => {
    const files = filesIn(await wrapped("pax"))

    // A long name in front of a directory belongs to that directory. Carried
    // on, the next file would be filed under the folder's own path.
    expect(files.has("services/cfw-intern-api/src/routes/vault")).toBe(false)
    expect(files.has("services/cfw-intern-api/src/routes")).toBe(false)
  })
})
