import { describe, expect, test } from "bun:test"
import { inSize, onTheAppStore, releaseIn } from "./ways"

const asset = (name: string, size: number) => ({ name, size })

describe("what the latest release says about itself", () => {
  const body = {
    tag_name: "v0.2.5",
    assets: [
      asset("gitquiet-0.2.5-chrome.zip", 2_738_353),
      asset("GitQuiet-safari.dmg", 3_107_585),
      asset("GitQuiet-macos-arm64.dmg", 20_784_713)
    ]
  }

  test("reads the version without the tag's v", () => {
    expect(releaseIn(body)?.version).toBe("0.2.5")
  })

  test("reads a size by the file name the page links to", () => {
    expect(releaseIn(body)?.sizes["GitQuiet-safari.dmg"]).toBe(3_107_585)
  })

  /*
   * Everything on the page works without this read: the links are fixed addresses
   * and the version is a line of small print beside them. So a rate limit, an
   * offline reader or a shape GitHub changed all have to end as nothing rather
   * than as a page that fails to draw.
   */
  test.each([
    ["nothing", undefined],
    ["an error", { message: "Not Found" }],
    ["a tag that is not a string", { tag_name: 5 }]
  ])("says nothing about %s", (_what, given) => {
    expect(releaseIn(given)).toBeUndefined()
  })

  test("holds no sizes when the assets are missing", () => {
    expect(releaseIn({ tag_name: "v0.2.5" })?.sizes).toEqual({})
  })

  test("skips an asset that has no size", () => {
    const half = { tag_name: "v0.2.5", assets: [{ name: "GitQuiet-safari.dmg" }] }
    expect(releaseIn(half)?.sizes).toEqual({})
  })
})

describe("a size a reader can compare to a download", () => {
  /*
   * Millions rather than mebibytes, because the number beside the link is read
   * again in the Finder afterwards and the Finder counts in millions. 19.8 there
   * against 20.8 here is a reader wondering which file they got.
   */
  test.each([
    [2_738_353, "2.7 MB"],
    [3_107_585, "3.1 MB"],
    [20_784_713, "20.8 MB"],
    [999_000, "1.0 MB"]
  ])("writes %i as %s", (bytes, said) => {
    expect(inSize(bytes)).toBe(said)
  })

  test("says nothing about a size it was not given", () => {
    expect(inSize(undefined)).toBeUndefined()
  })
})

describe("whether Apple is holding the app yet", () => {
  const listing = {
    resultCount: 1,
    results: [{ trackViewUrl: "https://apps.apple.com/app/gitquiet-for-safari/id6801924930" }]
  }

  test("gives the listing once there is one", () => {
    expect(onTheAppStore(listing)).toBe(
      "https://apps.apple.com/app/gitquiet-for-safari/id6801924930"
    )
  })

  /*
   * This is the answer for as long as the app sits in review, and it is the whole
   * reason the read is worth making: the row turns into a button on the hour Apple
   * approves, rather than on the day somebody remembers to deploy the site.
   */
  test.each([
    ["review has not finished", { resultCount: 0, results: [] }],
    ["the results are missing", { resultCount: 1 }],
    ["the one result has no address", { resultCount: 1, results: [{}] }],
    ["nothing came back", undefined]
  ])("says nothing while %s", (_what, given) => {
    expect(onTheAppStore(given)).toBeUndefined()
  })
})
