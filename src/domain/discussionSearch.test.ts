import { describe, expect, test } from "bun:test"

import { CHIPS, asWordsGo, asking, toggled, wordsIn } from "./discussionSearch"

describe("the filter bar, as terms in their own search", () => {
  const chip = (name: string) => CHIPS.find((one) => one.name === name)!

  /*
   * The chip this whole screen argues for, and it is two of GitHub's own terms rather than a
   * word of ours. `is:unanswered` alone is 98 of the 120 Questions counted; the pair is the 94
   * of those that somebody can finish by pointing at an answer already in the thread.
   */
  test("Stale is two of their terms, put in and taken out together", () => {
    const on = toggled("", chip("Stale"))

    expect(on).toBe("is:unanswered comments:>0")
    expect(asking(on, chip("Stale"))).toBe(true)
    expect(toggled(on, chip("Stale"))).toBe("")
  })

  /*
   * Half of Stale is Unanswered, and a line carrying only half of it must not light Stale up:
   * a chip that says it is on while the list is the wider one is a chip that lies.
   */
  test("half of a chip's terms is not the chip", () => {
    expect(asking("is:unanswered", chip("Stale"))).toBe(false)
    expect(asking("is:unanswered comments:>0", chip("Unanswered"))).toBe(true)
  })

  test("pressing one of a group takes off whichever of that group was on", () => {
    const top = toggled("", chip("Top"))
    const newest = toggled(top, chip("Newest"))

    expect(newest).toBe("sort:date_created")
    expect(asking(newest, chip("Top"))).toBe(false)
  })

  test("a chip of another group is left alone", () => {
    const both = toggled(toggled("", chip("Stale")), chip("Open"))

    expect(asking(both, chip("Stale"))).toBe(true)
    expect(asking(both, chip("Open"))).toBe(true)
  })

  /*
   * What the reader typed is theirs. A chip that reformatted the line, or a box that showed
   * `is:unanswered` as words to delete by hand, would take it away from them.
   */
  test("keeps the reader's own words out of the chips and back in again", () => {
    const line = toggled("memory leak", chip("Stale"))

    expect(wordsIn(line)).toBe("memory leak")
    expect(asWordsGo(line, "memory usage")).toBe("is:unanswered comments:>0 memory usage")
    expect(asking(asWordsGo(line, "memory usage"), chip("Stale"))).toBe(true)
  })

  test("emptying the box leaves every chip standing", () => {
    const line = toggled("memory leak", chip("Answered"))

    expect(asWordsGo(line, "")).toBe("is:answered")
  })
})
