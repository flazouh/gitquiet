import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { filesIn, unzipped } from "./archive"

/**
 * Against a tar this machine's own `tar` wrote, rather than one built to suit
 * the reader below. The format is somebody else's, and the whole risk here is
 * believing something about it that is not true.
 */
const made = async (): Promise<Uint8Array> => {
  const root = `/tmp/gitquiet-archive-${Date.now()}`
  const long = "long".repeat(40)
  await Bun.$`mkdir -p ${root}/gitquiet-abc123/src/ui`.quiet()
  await Bun.write(`${root}/gitquiet-abc123/README.md`, "# A repository\n")
  await Bun.write(`${root}/gitquiet-abc123/src/ui/place.ts`, "export const place = 1\n")
  await Bun.write(`${root}/gitquiet-abc123/src/ui/${long}.ts`, "export const long = 2\n")
  await Bun.$`tar -czf ${root}/out.tar.gz -C ${root} gitquiet-abc123`.quiet()

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
