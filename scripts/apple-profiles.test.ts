import { describe, expect, test } from "bun:test"
import { records } from "./appstore"
import { profileHomes, readable, usable, type Profile } from "./apple-profiles"

const now = new Date("2026-08-16T00:00:00Z")

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: "dev.gitquiet.GitQuiet-for-Safari Mac App Store",
  state: "ACTIVE",
  expires: "2027-08-15T21:48:08.000+00:00",
  content: "cHJvZmlsZQ==",
  ...over
})

describe("which of the profiles that came back can be judged", () => {
  const record = (attributes: Record<string, string>) => [{ id: "M3Q5NK3DB8", attributes }]

  test("keeps one that says everything about itself", () => {
    const whole = record({
      name: "dev.gitquiet.GitQuiet-for-Safari Mac App Store",
      profileState: "ACTIVE",
      expirationDate: "2027-08-15T21:48:08.000+00:00",
      profileContent: "cHJvZmlsZQ=="
    })

    expect(readable(records(whole))).toEqual([profile()])
  })

  /*
   * A profile with no name was once written out as `.provisionprofile`, a
   * dotfile, and the export then failed on a profile it could not find. Dropping
   * the record is what makes the script mint a new one instead.
   */
  test.each(["name", "profileState", "expirationDate", "profileContent"])(
    "drops one with no %s",
    (missing) => {
      const half: Record<string, string> = {
        name: "dev.gitquiet.GitQuiet-for-Safari Mac App Store",
        profileState: "ACTIVE",
        expirationDate: "2027-08-15T21:48:08.000+00:00",
        profileContent: "cHJvZmlsZQ=="
      }
      delete half[missing]

      expect(readable(records(record(half)))).toEqual([])
    }
  )

  test("has nothing to read from an account with no profiles", () => {
    expect(readable(records(undefined))).toEqual([])
  })
})

describe("which profile is worth signing with", () => {
  test("takes an active one that lasts", () => {
    expect(usable([profile()], now)?.content).toBe("cHJvZmlsZQ==")
  })

  test.each(["INVALID", "EXPIRED"])("passes over a %s one", (state) => {
    expect(usable([profile({ state })], now)).toBeNull()
  })

  /*
   * Signing with one that expires in hours makes a build Apple refuses days
   * later, once it is somebody's turn to read the mail about it.
   */
  test("passes over one that expires within the day", () => {
    expect(usable([profile({ expires: "2026-08-16T10:00:00.000+00:00" })], now)).toBeNull()
  })

  test("takes one that expires after the day is out", () => {
    expect(usable([profile({ expires: "2026-08-17T10:00:00.000+00:00" })], now)).not.toBeNull()
  })

  test("has nothing to take from an empty account", () => {
    expect(usable([], now)).toBeNull()
  })
})

/*
 * Apple answers a list with a list and a create with the one thing it made. Read
 * as two shapes, a create reply arrives as `undefined` and the script decides
 * nothing was made.
 */
describe("what came back as data", () => {
  test("reads a list as itself", () => {
    expect(records([{ id: "one", attributes: {} }, { id: "two", attributes: {} }])).toHaveLength(2)
  })

  test("reads the one thing a create answers with as a list of one", () => {
    expect(records({ id: "one", attributes: {} })).toEqual([{ id: "one", attributes: {} }])
  })

  test("reads nothing at all as an empty list", () => {
    expect(records(undefined)).toEqual([])
  })
})

describe("where Xcode looks for a profile", () => {
  test("names both places, under the home given", () => {
    expect(profileHomes("/Users/someone")).toEqual([
      "/Users/someone/Library/MobileDevice/Provisioning Profiles",
      "/Users/someone/Library/Developer/Xcode/UserData/Provisioning Profiles"
    ])
  })
})
