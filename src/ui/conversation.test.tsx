import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { aComment, aThread, bot, person } from "../../tests/snapshots"
import { Conversation } from "./Conversation"

afterEach(cleanup)

const twoSpeakers = aThread("t1", [
  aComment(person("reviewer-person"), "this name reads oddly"),
  aComment(person("author-person"), "renamed"),
  aComment(person("reviewer-person"), "better")
])

describe("the conversation section", () => {
  test("says who spoke with a face, not with a login", async () => {
    render(<Conversation threads={[twoSpeakers]} />)

    expect(screen.getAllByLabelText("reviewer-person").length).toBeGreaterThan(0)
    expect(screen.queryByText("reviewer-person")).toBeNull()

    await userEvent.click(screen.getAllByText("this name reads oddly")[0]!)

    expect(screen.queryByText("author-person")).toBeNull()
  })

  test("puts every speaker on the folded line, each one once", () => {
    render(<Conversation threads={[twoSpeakers]} />)

    const folded = screen.getAllByText("this name reads oddly")[0]!.closest("summary")
    if (folded === null) throw new Error("expected a folded line")

    // Three comments, two people: a face each, and the repeat speaker not
    // counted twice — the line answers "who is in this" at a glance.
    expect(folded.querySelectorAll('[role="img"]')).toHaveLength(2)
  })

  test("still marks a bot as one, since its face is a logo like any other", () => {
    render(<Conversation threads={[aThread("t2", [aComment(bot("copilot"), "nit")])]} />)

    expect(screen.getAllByLabelText("copilot")).toHaveLength(2)
    expect(screen.getByText("bot")).toBeDefined()
  })

  test("says how many still want an answer, and how many are done", () => {
    render(
      <Conversation
        threads={[
          aThread("t1", [aComment(person("ana"), "still wrong")]),
          aThread("t2", [aComment(person("ben"), "settled")], true),
          aThread("t3", [aComment(person("cal"), "also settled")], true)
        ]}
      />
    )

    expect(screen.getByText("1 open, 2 resolved")).toBeDefined()
  })

  test("counts nothing as resolved when nothing is", () => {
    render(<Conversation threads={[twoSpeakers]} />)

    expect(screen.getByText("1 open")).toBeDefined()
  })

  test("says so plainly when every thread has been settled", () => {
    render(<Conversation threads={[aThread("t1", [aComment(person("ana"), "done")], true)]} />)

    expect(screen.getByText("all 1 resolved")).toBeDefined()
  })

  test("marks a settled thread as settled, rather than only greying it", () => {
    render(
      <Conversation
        threads={[
          aThread("t1", [aComment(person("ana"), "still wrong")]),
          aThread("t2", [aComment(person("ben"), "settled")], true)
        ]}
      />
    )

    // Colour and opacity say nothing to a screen reader, so the state is on
    // the mark itself.
    const settled = screen.getByLabelText("Resolved").closest("details")
    expect(settled?.textContent).toContain("settled")
    expect(screen.getAllByLabelText("Resolved")).toHaveLength(1)
  })

  test("puts what still needs an answer above what does not", () => {
    render(
      <Conversation
        threads={[
          aThread("t1", [aComment(person("ana"), "settled first")], true),
          aThread("t2", [aComment(person("ben"), "still open")])
        ]}
      />
    )

    const rows = [...screen.getByRole("region", { name: "Conversation" }).querySelectorAll("summary")]

    expect(rows[0]?.textContent).toContain("still open")
    expect(rows[1]?.textContent).toContain("settled first")
  })

  test("counts the speakers a folded line has no room for", () => {
    const crowd = aThread(
      "t3",
      ["ana", "ben", "cal", "dee", "eli"].map((login) => aComment(person(login), `${login} spoke`))
    )
    render(<Conversation threads={[crowd]} />)

    const folded = screen.getAllByText("ana spoke")[0]!.closest("summary")!

    expect(folded.querySelectorAll('[role="img"]')).toHaveLength(3)
    expect(within(folded).getByText("+2")).toBeDefined()
  })
})
