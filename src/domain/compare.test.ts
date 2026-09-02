import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { compareIn, fileListRoute } from "./compare"

const parsed = (url: string) => Option.getOrNull(compareIn(url))
const at = (path: string) => `https://github.com${path}`

describe("reading a comparison out of an address", () => {
  test("reads the two refs either side of their range", () => {
    expect(parsed(at("/flazouh/gitquiet/compare/main...claude/gist-screen"))).toEqual({
      repo: { owner: "flazouh", repo: "gitquiet" },
      base: "main",
      head: "claude/gist-screen"
    })
  })

  test("keeps a branch that carries a slash whole", () => {
    // `claude/gist-screen` is two segments once a path is split, so the range is
    // rejoined rather than read out of the first segment after `compare`.
    expect(parsed(at("/o/r/compare/release/1.0...feature/x/y"))?.head).toBe("feature/x/y")
  })

  test("reads a two-dot range as well as a three-dot one", () => {
    // They serve both. The two mean different things to git and the same thing to this
    // screen, which lists what their fragment says changed and computes neither.
    expect(parsed(at("/o/r/compare/main..next"))).toMatchObject({ base: "main", head: "next" })
  })

  test("splits on the longest separator, so a dotted branch survives", () => {
    // `release/1.2...main` has three dots in it and only one of them is the range.
    expect(parsed(at("/o/r/compare/release/1.2...main"))).toMatchObject({
      base: "release/1.2",
      head: "main"
    })
  })

  test("leaves their branch picker alone", () => {
    // A bare `/compare` is a form, and nothing has been named to compare yet. Taking
    // that page would be an empty list where their form was.
    expect(parsed(at("/o/r/compare"))).toBeNull()
    expect(parsed(at("/o/r/compare/"))).toBeNull()
    expect(parsed(at("/o/r/compare/main..."))).toBeNull()
    expect(parsed(at("/o/r/compare/...main"))).toBeNull()
  })

  test("is nothing for their other pages, or another host", () => {
    expect(parsed(at("/o/r/pull/1"))).toBeNull()
    expect(parsed(at("/pulls"))).toBeNull()
    expect(parsed(at("/orgs/acme/compare/a...b"))).toBeNull()
    expect(parsed("https://example.com/o/r/compare/a...b")).toBeNull()
  })

  test("names the fragment their own page defers the file list to", () => {
    // The document itself carries no file list at all. Reading the page instead of the
    // fragment is reading a shell.
    const comparing = parsed(at("/flazouh/gitquiet/compare/main...claude/gist-screen"))!

    expect(fileListRoute(comparing)).toBe(
      "/flazouh/gitquiet/compare/file-list?range=main...claude%2Fgist-screen"
    )
  })
})
