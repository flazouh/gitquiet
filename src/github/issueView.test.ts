import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { loadFixture } from "../../tests/fixtures"
import { issueFrom } from "./issueView"

const reference = { owner: "react", repo: "react", number: 35000 }

const read = () => Effect.runSync(issueFrom(reference, loadFixture("issue-view")))

describe("one issue, as their own page reads it", () => {
  test("carries the title and the body in both forms", () => {
    const issue = read()

    expect(issue.title).toBe("Activity mode=“hidden” does not hide nested portals")
    // Both, for the reason a pull request keeps both: the markdown is what a
    // reply quotes and the HTML is what GitHub already rendered.
    expect(issue.description.html).toContain("<p")
    expect(issue.description.markdown.length).toBeGreaterThan(0)
  })

  test("says it is closed, and why", () => {
    // The distinction the Courts drop and a page keeps: somebody reading this
    // came to find out whether the thing was dealt with.
    const issue = read()

    expect(issue.state).toBe("closed")
    expect(issue.closing).toEqual(Option.some("completed"))
  })

  test("names the author with the face GitHub gave", () => {
    const issue = read()

    expect(issue.author.login).toBe("ceolinwill")
    expect(issue.author.isAutomated).toBe(false)
    expect(Option.isSome(issue.author.faceUrl)).toBe(true)
  })

  test("keeps a label's own colour rather than hashing its name", () => {
    const issue = read()

    expect(issue.labels).toEqual([
      {
        name: "Status: Unconfirmed",
        colour: "d4c5f9",
        description: Option.some("A potential issue that we haven't yet confirmed as a bug")
      }
    ])
  })

  test("drops the reactions nobody gave", () => {
    // Their payload lists all eight on every issue. Seven zeroes is not
    // information, and drawing them would be seven grey pills per issue.
    const issue = read()

    expect(issue.reactions).toEqual([
      { kind: "THUMBS_UP", count: 11, viewerReacted: false },
      { kind: "HEART", count: 2, viewerReacted: false }
    ])
  })

  test("reads the conversation out of the timeline and leaves the events", () => {
    // Twelve items, three of them comments. The other nine are labelings,
    // renames and cross references, which are not what anybody said.
    const issue = read()

    expect(issue.remarks).toHaveLength(3)
    expect(issue.remarks[0]?.author.login).toBe("amintai")
    expect(issue.remarks[0]?.html).toContain("<p")
  })

  test("keeps the conversation oldest first, as it was said", () => {
    const issue = read()
    const said = issue.remarks.map((remark) => remark.createdAt)

    expect([...said].sort()).toEqual(said)
  })

  test("asks GitHub what the reader may do rather than working it out", () => {
    // A triager can close an issue they did not raise and an archived
    // repository refuses everyone, so authorship is the wrong question.
    const issue = read()

    expect(issue.allowed.comment).toBe(true)
    // Null on this recording, which for a permission means no.
    expect(issue.allowed.close).toBe(false)
    expect(issue.allowed.label).toBe(false)
  })

  /**
   * Who may close one, out of the flags their query actually sends.
   *
   * `viewerCanClose` was asked for here for a year and GitHub has never sent it: their
   * persisted query carries thirteen `viewerCan…` fields and that is not one of them, so the
   * control it stood behind could never appear. Measured on two live issues — this
   * recording, where the reader has no write access and did not raise it, and
   * `flazouh/stack-probe` #77, where they have both — and the pair that moves is
   * `viewerCanUpdateMetadata` with `viewerDidAuthor`.
   *
   * Either one is enough, because GitHub lets an author close their own issue in a
   * repository they cannot write to.
   */
  describe("who may close it, which their query answers sideways", () => {
    const answering = (issue: Readonly<Record<string, unknown>>) => {
      const said = structuredClone(loadFixture("issue-view")) as {
        data: { repository: { issue: Record<string, unknown> } }
      }
      Object.assign(said.data.repository.issue, issue)

      return Effect.runSync(issueFrom(reference, said))
    }

    test("may not, where the reader neither wrote it nor may write here", () => {
      const issue = answering({ viewerCanUpdateMetadata: false, viewerDidAuthor: false })

      expect(issue.allowed.close).toBe(false)
      expect(issue.allowed.reopen).toBe(false)
    })

    test("may, where GitHub says this reader may change what an issue carries", () => {
      const issue = answering({ viewerCanUpdateMetadata: true, viewerDidAuthor: false })

      expect(issue.allowed.close).toBe(true)
      expect(issue.allowed.reopen).toBe(true)
    })

    test("may, where the reader raised it, write access or none", () => {
      const issue = answering({ viewerCanUpdateMetadata: false, viewerDidAuthor: true })

      expect(issue.allowed.close).toBe(true)
    })
  })

  test("names whoever is reading, for the box that writes a comment", () => {
    expect(Option.isSome(read().viewer)).toBe(true)
  })

  test("refuses a payload it cannot read rather than drawing half an issue", () => {
    const wrong = Effect.runSync(Effect.result(issueFrom(reference, { data: {} })))

    expect(wrong._tag).toBe("Failure")
  })
})
