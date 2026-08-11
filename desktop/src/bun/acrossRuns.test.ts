import { Effect } from "effect"
import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  DEFAULTS,
  fileFor,
  inFile,
  keepAcrossRuns,
  keepingLatest,
  readAcrossRuns
} from "./acrossRuns"

/**
 * What the window remembers between runs, and every way that can go wrong.
 *
 * A file on disk is the one part of an app that outlives the code that wrote it,
 * so most of these are about reading something this build did not write: an older
 * shape, a half-written file, a number somebody typed in by hand. All of them
 * answer with the defaults, because a window that will not open is worse than a
 * window that opens at the wrong zoom.
 */

const somewhere = (): string => join(mkdtempSync(join(tmpdir(), "working-set-")), "window.json")

const run = <A>(work: Effect.Effect<A, never>): Promise<A> => Effect.runPromise(work)

describe("what the window remembers between runs", () => {
  test("gives back the zoom it was handed", async () => {
    const where = inFile(somewhere())

    await run(keepAcrossRuns(where, { zoom: 1.4 }))

    expect(await run(readAcrossRuns(where))).toEqual({ zoom: 1.4 })
  })

  test("answers the defaults on a first ever run", async () => {
    expect(await run(readAcrossRuns(inFile(somewhere())))).toEqual(DEFAULTS)
  })

  test("answers the defaults for a file that is not JSON", async () => {
    const path = somewhere()
    await Bun.write(path, "{ this was half written when the power went")

    expect(await run(readAcrossRuns(inFile(path)))).toEqual(DEFAULTS)
  })

  test("answers the defaults for a shape another build wrote", async () => {
    // The same rule the window's own cache follows: what is kept here is small
    // enough to earn again, and reading a shape from two builds ago into a live
    // window is how a first paint becomes a crash.
    const path = somewhere()
    await Bun.write(path, JSON.stringify({ shape: 99, it: { zoom: 2 } }))

    expect(await run(readAcrossRuns(inFile(path)))).toEqual(DEFAULTS)
  })

  test("brings a zoom nobody could have pressed back onto the ladder", async () => {
    const path = somewhere()
    await Bun.write(path, JSON.stringify({ shape: 1, it: { zoom: 40 } }))

    expect((await run(readAcrossRuns(inFile(path)))).zoom).toBe(3)

    await Bun.write(path, JSON.stringify({ shape: 1, it: { zoom: 0.01 } }))
    expect((await run(readAcrossRuns(inFile(path)))).zoom).toBe(0.5)

    await Bun.write(path, JSON.stringify({ shape: 1, it: { zoom: "big" } }))
    expect((await run(readAcrossRuns(inFile(path)))).zoom).toBe(1)
  })

  test("says nothing when it cannot write, rather than taking the window down", async () => {
    // Everything here is a convenience. A read-only home directory, a full disk,
    // a sandbox that refuses: none of them is a reason for the app not to open.
    const where = inFile("/dev/null/not-a-directory/window.json")

    await run(keepAcrossRuns(where, { zoom: 1.2 }))

    expect(await run(readAcrossRuns(where))).toEqual(DEFAULTS)
  })
})

describe("keeping the latest of a burst", () => {
  test("writes what was set last, not whichever write finished last", async () => {
    // Three presses of Cmd+= arrive as three requests, and the first version wrote
    // from each of them: the window ended at 1.3 and the file said 1.1, because a
    // write started earlier landed later. Zoom is pressed in bursts, so the burst
    // is the unit worth writing.
    const path = somewhere()
    const keep = keepingLatest(inFile(path), 10)

    keep({ zoom: 1.1 })
    keep({ zoom: 1.2 })
    keep({ zoom: 1.3 })

    await Bun.sleep(60)

    expect((await run(readAcrossRuns(inFile(path)))).zoom).toBe(1.3)
  })

  test("writes nothing at all until the burst is over", async () => {
    const path = somewhere()
    const keep = keepingLatest(inFile(path), 40)

    keep({ zoom: 1.5 })
    await Bun.sleep(10)
    expect(await Bun.file(path).exists()).toBe(false)

    await Bun.sleep(60)
    expect((await run(readAcrossRuns(inFile(path)))).zoom).toBe(1.5)
  })
})

describe("where that file goes", () => {
  test("under Application Support, by the identifier the app is signed with", () => {
    expect(fileFor("dev.gitquiet.app", false)).toEndWith(
      "Library/Application Support/dev.gitquiet.app/window.json"
    )
  })

  test("somewhere else for a demo, so recording does not resize the real window", () => {
    const real = fileFor("dev.gitquiet.app", false)
    const demo = fileFor("dev.gitquiet.app", true)

    expect(demo).not.toBe(real)
    expect(demo).toEndWith("window-demo.json")
  })
})
