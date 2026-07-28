import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import type { Check } from "../domain/PullRequest"
import { checkRunIn, notesIn, spotIn } from "./annotations"

const real = await Bun.file("tests/fixtures/checkAnnotations.html").text()

const check = (url: string): Check => ({
  name: "ci / architecture (pull_request)",
  state: "failed",
  isRequired: true,
  summary: "",
  url,
  durationSeconds: 12
})

describe("finding the check run behind a check", () => {
  test("takes it from the job GitHub links to", () => {
    expect(
      checkRunIn(check("/OpenRouterIncubator/ori/actions/runs/30297001180/job/90080390889?pr=1392"))
    ).toBe("90080390889")
  })

  test("has nothing to say about a check that is not an Actions job", () => {
    expect(checkRunIn(check("https://openrouter.devinenterprise.com/review/ori/pull/1392"))).toBeUndefined()
  })
})

describe("reading what GitHub wrote against a check", () => {
  test("takes the step, the message and the severity off a real page", () => {
    const notes = notesIn(real)

    expect(notes).toHaveLength(1)
    expect(notes[0]?.where).toBe("Setup Sentrux")
    expect(notes[0]?.level).toBe("failure")
    expect(notes[0]?.message).toStartWith("The 'client-id' (or deprecated 'app-id') input must be set")
  })

  test("keeps every annotation on a check that has several", () => {
    const twice = real.replace("</table>", "") + real.slice(real.indexOf("<tbody>"))
    const notes = notesIn(twice)

    expect(notes.length).toBeGreaterThan(1)
  })

  test("reads a warning as a warning", () => {
    const notes = notesIn(real.replace("color-fg-danger", "color-fg-attention"))

    expect(notes[0]?.level).toBe("warning")
  })

  test("treats an unfamiliar icon as a failure rather than dropping the note", () => {
    const notes = notesIn(real.replace("color-fg-danger", "color-fg-something-new"))

    expect(notes[0]?.level).toBe("failure")
    expect(notes[0]?.message).not.toBe("")
  })

  test("skips an annotation with nothing written in it", () => {
    const empty = real.replace(
      /<div>The 'client-id'[^<]*<\/div>/,
      "<div>   </div>"
    )

    expect(notesIn(empty)).toEqual([])
  })

  test("comes back empty, not wrong, when the page stops looking like this", () => {
    expect(notesIn("<html><body><p>Something else entirely</p></body></html>")).toEqual([])
    expect(notesIn("")).toEqual([])
  })
})

describe("the place in the log a note points at", () => {
  test("is the step and the line GitHub linked to", () => {
    expect(Option.getOrThrow(spotIn("#annotation:4:43"))).toEqual({ step: 4, line: 43 })
  })

  test("comes off the real page along with the message", () => {
    expect(Option.getOrThrow(notesIn(real)[0]!.at)).toEqual({ step: 4, line: 43 })
  })

  test("is nothing when the link is not one of those", () => {
    expect(Option.isNone(spotIn("/OpenRouterIncubator/ori/actions/runs/1/job/2"))).toBe(true)
    expect(Option.isNone(spotIn(""))).toBe(true)
  })
})
