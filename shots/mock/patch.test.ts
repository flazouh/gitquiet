import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { ChangedFile } from "@/domain/PullRequest"
import { toPatch } from "@/domain/toPatch"
import { COMMIT } from "./commit"
import { SNAPSHOT } from "./pullRequest"

/**
 * The hunk headers of every mock patch, checked against the lines under them.
 *
 * `toPatch` hands the diff to the renderer as text, hunk headers and all, so a header
 * whose counts disagree with its own body is a header the engine believes: it draws the
 * wrong line numbers down the gutter, and a review thread anchored by number lands
 * beside the wrong line. Nothing in the picture says which of the two was wrong, and
 * the picture is the deliverable, so the arithmetic is checked here instead of by eye.
 *
 * Written against the mocks rather than against a fixture, because the headers are
 * typed out by hand in them and that is where a wrong one comes from.
 */

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

type Counted = {
  readonly said: { readonly before: number; readonly after: number }
  readonly found: { readonly before: number; readonly after: number }
  readonly at: string
}

/** Every hunk of a patch, as what its header claims beside what it holds. */
const hunksOf = (patch: string): ReadonlyArray<Counted> => {
  const found: Array<Counted> = []
  let open: { said: Counted["said"]; before: number; after: number; at: string } | null = null

  const shut = () => {
    if (open !== null) {
      found.push({ said: open.said, found: { before: open.before, after: open.after }, at: open.at })
    }
  }

  for (const text of patch.split("\n")) {
    const header = HUNK.exec(text)

    if (header !== null) {
      shut()
      open = {
        // A count left off means one line, which is how a one-line hunk is written.
        said: { before: Number(header[2] ?? "1"), after: Number(header[4] ?? "1") },
        before: 0,
        after: 0,
        at: text
      }
      continue
    }

    if (open === null) continue

    // The three lines that begin a patch are not part of a hunk, and neither is
    // the empty line `toPatch` ends on.
    if (text.startsWith("+")) open.after += 1
    else if (text.startsWith("-")) open.before += 1
    else if (text.startsWith(" ")) {
      open.before += 1
      open.after += 1
    }
  }

  shut()
  return found
}

const patchOf = (file: ChangedFile): string => {
  const said = toPatch(file)
  if (Option.isNone(said)) throw new Error(`no patch for ${file.path}`)
  return said.value
}

const checking: ReadonlyArray<{ readonly view: string; readonly files: ReadonlyArray<ChangedFile> }> = [
  { view: "pull-request", files: SNAPSHOT.files },
  { view: "commit", files: COMMIT.files }
]

describe("the patches the mocks hand to the diff renderer", () => {
  for (const { view, files } of checking) {
    test(`count their own hunks correctly in ${view}`, () => {
      const wrong = files.flatMap((file) =>
        hunksOf(patchOf(file))
          .filter(
            (hunk) =>
              hunk.said.before !== hunk.found.before || hunk.said.after !== hunk.found.after
          )
          .map((hunk) => `${file.path} ${hunk.at} holds -${hunk.found.before} +${hunk.found.after}`)
      )

      expect(wrong).toEqual([])
    })

    test(`have a hunk in every file of ${view}`, () => {
      for (const file of files) {
        expect(hunksOf(patchOf(file)).length).toBeGreaterThan(0)
      }
    })

    test(`count the lines they changed the way the rail says they do in ${view}`, () => {
      for (const file of files) {
        const lines = Option.getOrThrow(file.diff).lines
        expect({
          added: lines.filter((line) => line.kind === "added").length,
          deleted: lines.filter((line) => line.kind === "deleted").length
        }).toEqual({ added: file.linesAdded, deleted: file.linesDeleted })
      }
    })
  }
})
