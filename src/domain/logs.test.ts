import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { LogLine } from "./PullRequest"
import { around, foldedInto, linesIn, pathIn, troubleIn } from "./logs"

/** Real lines, timestamps and all, from ci / architecture on octo-repo#1392. */
const real = [
  "2026-07-27T19:09:38.6434993Z Prepare all required actions",
  "2026-07-27T19:09:38.6435681Z ##[group]Run ./.github/actions/setup-sentrux",
  "2026-07-27T19:09:38.7416402Z Cache hit for: sentrux-Linux-X64",
  "2026-07-27T19:09:38.7416500Z ##[endgroup]",
  "2026-07-27T19:09:39.1000000Z ##[error]The 'client-id' input must be set to a non-empty string.",
  "2026-07-27T19:09:39.2000000Z     at run (/home/runner/work/_actions/main.cjs:23425:11)"
].join("\n")

describe("reading a step's log", () => {
  test("takes the timestamp off, since every line carries the same one", () => {
    expect(linesIn(real)[0]?.text).toBe("Prepare all required actions")
  })

  test("keeps GitHub's line numbers, because an annotation points at one", () => {
    expect(linesIn(real).map((line) => line.at)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test("turns a marker into a tone rather than leaving it in the words", () => {
    const lines = linesIn(real)

    expect(lines[4]?.tone).toBe("error")
    expect(lines[4]?.text).toBe("The 'client-id' input must be set to a non-empty string.")
    expect(lines[1]?.tone).toBe("group")
    expect(lines[1]?.text).toBe("Run ./.github/actions/setup-sentrux")
    expect(lines[0]?.tone).toBe("plain")
  })

  test("leaves an unfamiliar marker's words alone but does not colour them", () => {
    const lines = linesIn("2026-07-27T19:09:38.6434993Z ##[debug]something internal")

    expect(lines[0]?.tone).toBe("plain")
    expect(lines[0]?.text).toBe("something internal")
  })

  test("keeps a line that has no timestamp at all", () => {
    expect(linesIn("plain old line")[0]).toMatchObject({ at: 1, text: "plain old line", tone: "plain" })
  })

  test("counts blank lines, so the numbering still points where GitHub says", () => {
    const lines = linesIn("2026-01-01T00:00:00.0Z first\n\n2026-01-01T00:00:00.0Z third")

    expect(lines).toHaveLength(3)
    expect(lines[2]?.text).toBe("third")
  })

  test("does not invent a line after the final newline", () => {
    expect(linesIn("only one\n")).toHaveLength(1)
    expect(linesIn("")).toEqual([])
  })
})

const long = (count: number) =>
  linesIn(
    Array.from({ length: count }, (_, at) => `2026-01-01T00:00:00.0Z line ${at + 1}`).join("\n")
  )

describe("the stretch worth showing", () => {
  test("is the whole log when the log is short", () => {
    const lines = long(30)

    expect(around(lines, 4, 40)).toEqual(lines)
  })

  test("is a window around the line the note points at", () => {
    const shown = around(long(500), 250, 40)

    expect(shown).toHaveLength(81)
    expect(shown[0]?.at).toBe(210)
    expect(shown.at(-1)?.at).toBe(290)
  })

  test("does not run off either end of the log", () => {
    const early = around(long(500), 3, 40)
    expect(early[0]?.at).toBe(1)
    expect(early).toHaveLength(81)

    const late = around(long(500), 499, 40)
    expect(late.at(-1)?.at).toBe(500)
    expect(late).toHaveLength(81)
  })

  test("shows the end when the line pointed at is not in the log", () => {
    const shown = around(long(500), 9000, 40)

    expect(shown.at(-1)?.at).toBe(500)
  })
})

const only = (line: LogLine | undefined) => line?.pieces.map((piece) => piece.text).join("")

describe("colour a tool wrote the line in", () => {
  test("comes off the words and is kept as a colour", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z \u001b[31mFAIL\u001b[0m src/x.test.ts")

    expect(line?.text).toBe("FAIL src/x.test.ts")
    expect(Option.getOrUndefined(line!.pieces[0]!.colour)).toBe("red")
    expect(Option.isNone(line!.pieces.at(-1)!.colour)).toBe(true)
  })

  test("does not hide a marker standing behind it", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z \u001b[36;1m##[error]it broke\u001b[0m")

    expect(line?.tone).toBe("error")
    expect(line?.text).toBe("it broke")
  })

  test("keeps the words when the codes are ones we have no colour for", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z \u001b[7m\u001b[38;5;204mfancy\u001b[0m")

    expect(line?.text).toBe("fancy")
  })

  test("leaves a line with no codes in one piece", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z ordinary words")

    expect(line?.pieces).toHaveLength(1)
    expect(only(line)).toBe("ordinary words")
  })
})

describe("files a line names", () => {
  test("are found where a compiler puts them", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z src/x.ts(50,10): error TS2304: no name")
    const named = line!.pieces.flatMap((piece) => (Option.isSome(piece.file) ? [piece.file.value] : []))

    expect(named[0]?.path).toBe("src/x.ts")
    expect(named[0]?.line).toBe(50)
    expect(Option.getOrUndefined(named[0]!.column)).toBe(10)
  })

  test("are found where everything else puts them", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z  at run (src/app/main.ts:23:11)")
    const named = line!.pieces.flatMap((piece) => (Option.isSome(piece.file) ? [piece.file.value] : []))

    expect(named[0]).toMatchObject({ path: "src/app/main.ts", line: 23 })
  })

  test("lose the runner's checkout path, which is nobody's file", () => {
    const [line] = linesIn(
      "2026-01-01T00:00:00.0Z  at x (/home/runner/work/octo-repo/octo-repo/src/deep/thing.ts:8:2)"
    )
    const named = line!.pieces.flatMap((piece) => (Option.isSome(piece.file) ? [piece.file.value] : []))

    expect(named[0]?.path).toBe("src/deep/thing.ts")
  })

  test("are not claimed for a file named without a line", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z reading package.json and tsconfig.json")

    expect(line!.pieces.every((piece) => Option.isNone(piece.file))).toBe(true)
  })

  test("leave the rest of the line beside them, whole", () => {
    const [line] = linesIn("2026-01-01T00:00:00.0Z error in src/x.ts:9:1 while building")

    expect(only(line)).toBe("error in src/x.ts:9:1 while building")
  })
})

describe("folding a log into what it is made of", () => {
  const log = linesIn(
    [
      "2026-01-01T00:00:00.0Z ##[group]Runner Image",
      "2026-01-01T00:00:00.0Z   Ubuntu 24.04",
      "2026-01-01T00:00:00.0Z ##[endgroup]",
      "2026-01-01T00:00:00.0Z Running the tests",
      "2026-01-01T00:00:00.0Z ##[group]Install dependencies",
      "2026-01-01T00:00:00.0Z ##[error]it broke",
      "2026-01-01T00:00:00.0Z ##[endgroup]"
    ].join("\n")
  )

  test("puts what a group holds inside it, and leaves loose lines loose", () => {
    const parts = foldedInto(log)

    expect(parts.map((part) => part.kind)).toEqual(["group", "line", "group"])
    expect(parts[0]?.kind === "group" && parts[0].title.text).toBe("Runner Image")
    expect(parts[0]?.kind === "group" && parts[0].lines).toHaveLength(1)
  })

  test("lets a shut group say it is holding an error", () => {
    const parts = foldedInto(log)

    expect(parts[0]?.kind === "group" && parts[0].worst).toBe("plain")
    expect(parts[2]?.kind === "group" && parts[2].worst).toBe("error")
  })

  test("keeps the lines of a group that was never closed", () => {
    const parts = foldedInto(
      linesIn(
        [
          "2026-01-01T00:00:00.0Z ##[group]Killed midway",
          "2026-01-01T00:00:00.0Z   halfway through"
        ].join("\n")
      )
    )

    expect(parts[0]?.kind === "group" && parts[0].lines).toHaveLength(1)
  })

  test("has nothing to fold in a log with no groups", () => {
    expect(foldedInto(linesIn("2026-01-01T00:00:00.0Z alone")).map((part) => part.kind)).toEqual([
      "line"
    ])
  })

  test("finds every error to jump between", () => {
    expect(troubleIn(log)).toEqual([6])
  })
})

describe("matching a named file to one in the pull request", () => {
  const files = ["src/app/main.ts", "packages/api/src/x.ts", "README.md"]

  test("takes the exact path when there is one", () => {
    expect(pathIn(files, "src/app/main.ts")).toBe("src/app/main.ts")
  })

  test("takes the one path that ends the same way", () => {
    expect(pathIn(files, "src/x.ts")).toBe("packages/api/src/x.ts")
  })

  test("takes none when two files would both do", () => {
    expect(pathIn(["a/x.ts", "b/x.ts"], "x.ts")).toBeUndefined()
  })

  test("takes none for a file this pull request does not touch", () => {
    expect(pathIn(files, "src/untouched.ts")).toBeUndefined()
  })
})

describe("places that are not anyone's file", () => {
  const named = (row: string) =>
    linesIn(`2026-01-01T00:00:00.0Z ${row}`)[0]!.pieces.flatMap((piece) =>
      Option.isSome(piece.file) ? [piece.file.value.path] : []
    )

  test("are left alone when they live on the runner's disk", () => {
    expect(named("at run (/home/runner/work/_actions/actions/x/v3/dist/main.cjs:23425:11)")).toEqual(
      []
    )
    expect(named("at x (/usr/lib/node/internal/modules/run_main.js:154:5)")).toEqual([])
  })

  test("are left alone when they live in a dependency", () => {
    expect(named("at y (node_modules/effect/dist/index.js:12:1)")).toEqual([])
  })

  test("still find the repository's own file on the same line", () => {
    expect(named("src/app/main.ts:23:11 called by /usr/lib/thing.js:1:1")).toEqual([
      "src/app/main.ts"
    ])
  })
})
