import { describe, expect, test } from "bun:test"
import type { TargetBrowser } from "wxt"
import config from "./wxt.config"

/*
 * What each store will accept, which is not the same number.
 *
 * The App Store checks this on upload and rejects the whole package: a Safari
 * release sat at 128 characters and Apple answered "the description field must
 * be present, of string type, and 112 or fewer characters long". Nothing before
 * that point complained, and the build it refused took forty minutes to make.
 */
const longest = { safari: 112, chrome: 132, edge: 132, firefox: 132 } as const

const describeFor = (browser: TargetBrowser) => {
  const manifest = config.manifest
  if (typeof manifest !== "function") throw new Error("the manifest is no longer built per browser")
  // Only `browser` is read, and the rest of what wxt passes is of no interest here.
  return manifest({ browser } as Parameters<typeof manifest>[0]) as {
    readonly description: string
    readonly name: string
  }
}

describe("the manifest description", () => {
  test.each(Object.entries(longest))("fits what %s accepts", (browser, limit) => {
    const { description } = describeFor(browser as TargetBrowser)

    expect(description.length).toBeLessThanOrEqual(limit)
  })

  test("names the browser it is read in", () => {
    expect(describeFor("safari").description).toContain("Safari")
    expect(describeFor("firefox").description).toContain("Firefox")
  })

  /*
   * An unknown target falls back to "your browser", which is longer than any of
   * the names, so it is the length that decides whether the wording fits.
   */
  test("fits even where the browser has no name of its own", () => {
    const { description } = describeFor("opera")

    expect(description).toContain("your browser")
    expect(description.length).toBeLessThanOrEqual(longest.safari)
  })
})
