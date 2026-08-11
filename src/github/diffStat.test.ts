import { describe, expect, it } from "bun:test"
import { statIn } from "./diffStat"

const diff = (...lines: ReadonlyArray<string>) => lines.join("\n")

describe("the size of a commit, out of the diff GitHub serves for it", () => {
  it("is the files it touched and the lines it moved", () => {
    expect(
      statIn(
        diff(
          "diff --git a/one.ts b/one.ts",
          "index 1111111..2222222 100644",
          "--- a/one.ts",
          "+++ b/one.ts",
          "@@ -1,3 +1,4 @@",
          " kept",
          "-gone",
          "+arrived",
          "+arrived too"
        )
      )
    ).toEqual({ files: 1, added: 2, removed: 1 })
  })

  it("counts every file the commit touched, not only the first", () => {
    expect(
      statIn(
        diff(
          "diff --git a/one.ts b/one.ts",
          "--- a/one.ts",
          "+++ b/one.ts",
          "@@ -1 +1 @@",
          "+one",
          "diff --git a/two.ts b/two.ts",
          "--- a/two.ts",
          "+++ b/two.ts",
          "@@ -1 +1 @@",
          "-two"
        )
      )
    ).toEqual({ files: 2, added: 1, removed: 1 })
  })

  it("does not read the two file headings as a line added and a line removed", () => {
    // `---` and `+++` start with the same characters a moved line does, and a
    // commit touching five files would be five additions and five deletions
    // heavier than it is. The one mistake this parser can make quietly.
    expect(
      statIn(
        diff("diff --git a/one.ts b/one.ts", "--- a/one.ts", "+++ b/one.ts", "@@ -0,0 +1 @@")
      )
    ).toEqual({ files: 1, added: 0, removed: 0 })
  })

  it("counts a binary file as a file, and as no lines at all", () => {
    expect(
      statIn(
        diff(
          "diff --git a/face.png b/face.png",
          "index 1111111..2222222 100644",
          "GIT binary patch",
          "literal 5732",
          "zcmV-`abcdef"
        )
      )
    ).toEqual({ files: 1, added: 0, removed: 0 })
  })

  it("counts a rename that changed nothing as the one file it is", () => {
    expect(
      statIn(
        diff(
          "diff --git a/old.ts b/new.ts",
          "similarity index 100%",
          "rename from old.ts",
          "rename to new.ts"
        )
      )
    ).toEqual({ files: 1, added: 0, removed: 0 })
  })

  it("is nothing at all for a merge, whose diff GitHub serves as an empty one", () => {
    expect(statIn("")).toEqual({ files: 0, added: 0, removed: 0 })
  })

  it("reads a line whose own text starts with a plus as one line", () => {
    // `++x` inside a patch is an added line reading `+x`, and the guard against
    // the `+++` heading must not eat it.
    expect(
      statIn(
        diff(
          "diff --git a/one.ts b/one.ts",
          "--- a/one.ts",
          "+++ b/one.ts",
          "@@ -1 +1,2 @@",
          "++x",
          "--y"
        )
      )
    ).toEqual({ files: 1, added: 1, removed: 1 })
  })
})
