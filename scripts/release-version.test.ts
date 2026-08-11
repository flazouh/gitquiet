import { describe, expect, test } from "bun:test"
import { releaseVersion } from "./release-version"

describe("releaseVersion", () => {
  test("removes the release tag prefix", () => {
    expect(releaseVersion("v1.2.3")).toBe("1.2.3")
  })

  test("accepts Chrome's four-part version format", () => {
    expect(releaseVersion("v1.2.3.4")).toBe("1.2.3.4")
  })

  test.each(["1.2.3", "v1.2.3-beta.1", "v01.2.3", "v65536.0.0", "v0"])(
    "rejects an invalid release tag: %s",
    (tag) => {
      expect(() => releaseVersion(tag)).toThrow(`Invalid extension release tag: ${tag}`)
    }
  )
})
