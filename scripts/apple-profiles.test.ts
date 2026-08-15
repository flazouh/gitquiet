import { describe, expect, test } from "bun:test"
import { profileHomes, usable, type Profile } from "./apple-profiles"

const now = new Date("2026-08-16T00:00:00Z")

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: "M3Q5NK3DB8",
  name: "dev.gitquiet.GitQuiet-for-Safari Mac App Store",
  bundle: "359FBXRQ66",
  state: "ACTIVE",
  expires: "2027-08-15T21:48:08.000+00:00",
  ...over
})

describe("usable", () => {
  test("takes an active profile for the bundle asked about", () => {
    expect(usable([profile()], "359FBXRQ66", now)?.id).toBe("M3Q5NK3DB8")
  })

  test("passes over a profile for another bundle", () => {
    expect(usable([profile()], "Q25TF893FW", now)).toBeNull()
  })

  test.each(["INVALID", "EXPIRED"])("passes over a %s profile", (state) => {
    expect(usable([profile({ state })], "359FBXRQ66", now)).toBeNull()
  })

  /*
   * Signing with one that expires in hours makes a build Apple refuses days
   * later, once it is somebody's turn to read the mail about it.
   */
  test("passes over one that expires within the day", () => {
    const soon = profile({ expires: "2026-08-16T10:00:00.000+00:00" })

    expect(usable([soon], "359FBXRQ66", now)).toBeNull()
  })

  test("takes one that expires after the day is out", () => {
    const later = profile({ expires: "2026-08-17T10:00:00.000+00:00" })

    expect(usable([later], "359FBXRQ66", now)?.id).toBe("M3Q5NK3DB8")
  })

  test("has nothing to take from an empty account", () => {
    expect(usable([], "359FBXRQ66", now)).toBeNull()
  })
})

describe("profileHomes", () => {
  test("names both places Xcode reads, under the home given", () => {
    expect(profileHomes("/Users/someone")).toEqual([
      "/Users/someone/Library/MobileDevice/Provisioning Profiles",
      "/Users/someone/Library/Developer/Xcode/UserData/Provisioning Profiles"
    ])
  })
})
