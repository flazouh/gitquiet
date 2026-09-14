import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { filesIn, unzipped } from "./archive"

/**
 * What this machine's `tar` calls the format GitHub serves.
 *
 * `git archive` writes GNU-format tars and codeload serves what it wrote, so GNU is
 * what the reader below is parsing. GNU tar spells that format `gnu` and macOS's
 * bsdtar spells it `gnutar`, and neither accepts the other's word, so the one this
 * machine takes is found by asking it.
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
 * header in front of every single entry, and the reader below drops a file that
 * follows a pax header on purpose — it cannot trust the truncated name in the header
 * after it. So on a Mac this fixture held nothing at all and the same test on Linux
 * held everything, which is a test that measures the machine rather than the parser.
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
