import { describe, expect, test } from "bun:test"
import { nextVersion } from "./next-version"

describe("nextVersion", () => {
  test("raises the patch", () => {
    expect(nextVersion("v0.2.0", "patch")).toBe("v0.2.1")
  })

  test("raises the minor and drops the patch", () => {
    expect(nextVersion("v0.2.7", "minor")).toBe("v0.3.0")
  })

  test("raises the major and drops the rest", () => {
    expect(nextVersion("v1.4.7", "major")).toBe("v2.0.0")
  })

  // The first release of a repository that has never been tagged. Chrome
  // refuses an all-zero version, so counting starts at the first minor.
  test("starts at v0.1.0 when nothing is tagged yet", () => {
    expect(nextVersion("", "minor")).toBe("v0.1.0")
  })

  test.each(["0.2.0", "v0.2", "v0.2.0.1", "v0.2.0-beta.1", "v01.2.0"])(
    "rejects a tag it cannot count from: %s",
    (tag) => {
      expect(() => nextVersion(tag, "patch")).toThrow(`Cannot count up from tag: ${tag}`)
    }
  )

  test("rejects a bump it does not know", () => {
    // @ts-expect-error -- the workflow offers three choices; this guards the fourth.
    expect(() => nextVersion("v0.2.0", "sideways")).toThrow("Unknown bump: sideways")
  })

  test.each([
    ["v65535.0.0", "major"],
    ["v0.65535.0", "minor"],
    ["v0.0.65535", "patch"]
  ] as const)("refuses to pass the store's ceiling: %s %s", (tag, bump) => {
    expect(() => nextVersion(tag, bump)).toThrow("Version part above 65535")
  })
})
