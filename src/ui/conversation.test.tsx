import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { aComment, aRemark, aThread, bot, person } from "../../tests/snapshots"
import type { Remark } from "../domain/PullRequest"
import { Conversation } from "./Conversation"

afterEach(cleanup)

/** Nothing said about the pull request itself, which most of these are about. */
const NO_REMARKS: ReadonlyArray<Remark> = []

const twoSpeakers = aThread("t1", [
  aComment(person("reviewer-person"), "this name reads oddly"),
  aComment(person("author-person"), "renamed"),
  aComment(person("reviewer-person"), "better")
])

describe("the conversation section", () => {
  test("does not build folded comments until the thread opens", async () => {
    render(<Conversation threads={[twoSpeakers]} remarks={NO_REMARKS} />)

    expect(screen.queryByText("renamed")).toBeNull()

    await userEvent.click(screen.getByText("this name reads oddly"))

    expect(screen.getByText("renamed")).toBeDefined()
  })

  test("says who spoke with a face, not with a login", async () => {
    render(<Conversation threads={[twoSpeakers]} remarks={NO_REMARKS} />)

    expect(screen.getAllByLabelText("reviewer-person").length).toBeGreaterThan(0)
    expect(screen.queryByText("reviewer-person")).toBeNull()

    await userEvent.click(screen.getAllByText("this name reads oddly")[0]!)

    expect(screen.queryByText("author-person")).toBeNull()
  })

  test("puts every speaker on the folded line, each one once", () => {
    render(<Conversation threads={[twoSpeakers]} remarks={NO_REMARKS} />)

    const folded = screen.getAllByText("this name reads oddly")[0]!.closest("summary")
    if (folded === null) throw new Error("expected a folded line")

    // Three comments, two people: a face each, and the repeat speaker not
    // counted twice — the line answers "who is in this" at a glance.
    expect(folded.querySelectorAll('[role="img"]')).toHaveLength(2)
  })

  test("still marks a bot as one, since its face is a logo like any other", async () => {
    render(<Conversation threads={[aThread("t2", [aComment(bot("copilot"), "nit")])]} remarks={NO_REMARKS} />)

    expect(screen.getAllByLabelText("copilot")).toHaveLength(1)

    await userEvent.click(screen.getByText("nit"))

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
        remarks={NO_REMARKS}
      />
    )

    expect(screen.getByText("1 open, 2 resolved")).toBeDefined()
  })

  test("counts nothing as resolved when nothing is", () => {
    render(<Conversation threads={[twoSpeakers]} remarks={NO_REMARKS} />)

    expect(screen.getByText("1 open")).toBeDefined()
  })

  test("says so plainly when every thread has been settled", () => {
    render(<Conversation threads={[aThread("t1", [aComment(person("ana"), "done")], true)]} remarks={NO_REMARKS} />)

    expect(screen.getByText("all 1 resolved")).toBeDefined()
  })

  test("marks a settled thread as settled, rather than only greying it", () => {
    render(
      <Conversation
        threads={[
          aThread("t1", [aComment(person("ana"), "still wrong")]),
          aThread("t2", [aComment(person("ben"), "settled")], true)
        ]}
        remarks={NO_REMARKS}
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
        remarks={NO_REMARKS}
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
    render(<Conversation threads={[crowd]} remarks={NO_REMARKS} />)

    const folded = screen.getAllByText("ana spoke")[0]!.closest("summary")!

    expect(folded.querySelectorAll('[role="img"]')).toHaveLength(3)
    expect(within(folded).getByText("+2")).toBeDefined()
  })
})

/**
 * The remarks are what made this section wrong on `flowline#1934`: no review
 * threads at all, one remark on the timeline, and a column that said nothing
 * had been said. A remark belongs in the same list — it is the same discussion.
 */
describe("remarks about the pull request rather than about a line", () => {
  test("shows one even when no line has been commented on at all", async () => {
    render(<Conversation threads={[]} remarks={[aRemark("r1", bot("railway-app[bot]"), "Deployed to staging")]} />)

    expect(screen.getAllByText("Deployed to staging")).toHaveLength(1)
    expect(screen.queryByText("nothing said yet")).toBeNull()

    await userEvent.click(screen.getByText("Deployed to staging"))

    expect(screen.getAllByText("Deployed to staging")).toHaveLength(2)
  })

  test("counts it in the summary, since it cannot be resolved or left open", () => {
    render(
      <Conversation
        threads={[]}
        remarks={[
          aRemark("r1", person("ana"), "pushed the fix"),
          aRemark("r2", person("ben"), "thanks")
        ]}
      />
    )

    expect(screen.getByText("2 remarks")).toBeDefined()
  })

  test("says both counts when a pull request has threads and remarks", () => {
    render(
      <Conversation
        threads={[aThread("t1", [aComment(person("ana"), "still wrong")])]}
        remarks={[aRemark("r1", person("ben"), "pushed the fix")]}
      />
    )

    expect(screen.getByText("1 open, 1 remark")).toBeDefined()
  })

  test("puts what is owed above what is only said", () => {
    render(
      <Conversation
        threads={[aThread("t1", [aComment(person("ana"), "still wrong")])]}
        remarks={[aRemark("r1", person("ben"), "pushed the fix")]}
      />
    )

    const rows = [...screen.getByRole("region", { name: "Conversation" }).querySelectorAll("summary")]

    expect(rows[0]?.textContent).toContain("still wrong")
    expect(rows[1]?.textContent).toContain("pushed the fix")
  })

  test("still says nothing has been said when neither is there", () => {
    render(<Conversation threads={[]} remarks={[]} />)

    expect(screen.getByText("nothing said yet")).toBeDefined()
  })

  test("marks an app as one, as it does in a thread", async () => {
    render(<Conversation threads={[]} remarks={[aRemark("r1", bot("copilot"), "nit")]} />)

    await userEvent.click(screen.getByText("nit"))

    expect(screen.getByText("bot")).toBeDefined()
  })
})
