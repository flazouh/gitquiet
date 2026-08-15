import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import {
  aCheck,
  aComment,
  aCommit,
  aFile,
  anchoredAt,
  aSnapshot,
  aThread,
  bot,
  person,
  VIEWER
} from "../../tests/snapshots"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import { ControlCenter } from "./ControlCenter"

afterEach(cleanup)

const viewer = person(VIEWER)
const dana = person("dana")
const machine = bot("copilot")

const showing = (
  parts: Partial<PullRequestSnapshot>,
  onOpen?: (path: string) => void,
  onOpenCommit?: (sha: string) => void
) => render(<ControlCenter snapshot={aSnapshot(parts)} onOpen={onOpen} onOpenCommit={onOpenCommit} />)

/** A pull request the reader reviewed once, with `after` landing on it since. */
const reviewedThen = (after: ReadonlyArray<string>): Partial<PullRequestSnapshot> => ({
  commits: [aCommit("aaa"), ...after.map((sha) => aCommit(sha))],
  viewer: { login: VIEWER, lastReviewPoint: Option.some("aaa") }
})

const court = (name: string) => screen.getByRole("list", { name })

const rowsIn = (name: string) => within(court(name)).getAllByRole("listitem")

describe("what one pull request owes, in four Courts", () => {
  test("names only the Courts that hold something", () => {
    showing({ checks: [aCheck("test", "failed")] })

    expect(court("Needs You")).toBeDefined()
    expect(screen.queryByRole("list", { name: "Waiting" })).toBeNull()
    expect(screen.queryByRole("list", { name: "Running" })).toBeNull()
  })

  test("holds each item in the Court that owes it", async () => {
    showing({
      checks: [aCheck("test", "failed"), aCheck("build", "running"), aCheck("lint", "succeeded")],
      threads: [aThread("t1", [aComment(dana), aComment(viewer)])]
    })

    expect(rowsIn("Needs You").length).toBe(1)
    expect(rowsIn("Waiting").length).toBe(1)
    expect(rowsIn("Needs You").length).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Settled/ }))
    expect(rowsIn("Settled").length).toBe(1)
  })

  test("keeps Settled folded, forty green checks being nobody's afternoon", () => {
    // Found on a merged pull request whose panel came to twelve hundred pixels of
    // rows that said "this passed": every one of them true, none of them owed.
    showing({ checks: [aCheck("test", "succeeded")] })

    expect(screen.queryByRole("list", { name: "Settled" })).toBeNull()
    expect(screen.getByRole("button", { name: /Settled/ })).toBeDefined()
  })

  test("folds a Court that is open, the reader having said what they want to see", async () => {
    showing({ checks: [aCheck("test", "failed")] })

    expect(rowsIn("Needs You").length).toBe(1)

    await userEvent.click(screen.getByRole("button", { name: /Needs You/ }))
    expect(screen.queryByRole("list", { name: "Needs You" })).toBeNull()
  })

  test("counts what a Court holds beside its name, so it need not be read to be weighed", () => {
    showing({ checks: [aCheck("a", "failed"), aCheck("b", "failed"), aCheck("c", "failed")] })

    expect(within(screen.getByRole("heading", { name: /Needs You/ })).getByText("3")).toBeDefined()
  })

  test("says a check by its name", () => {
    showing({ checks: [aCheck("test", "failed")] })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("test")
  })

  test("says a thread by whoever spoke in it last, which is who it is waiting on", () => {
    showing({ threads: [aThread("t1", [aComment(viewer), aComment(dana, "still wrong")])] })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("dana")
  })

  test("marks a finding as a machine's, six of them not being six colleagues", () => {
    showing({
      threads: [
        aThread("t1", [aComment(machine, "possible null")]),
        aThread("t2", [aComment(dana, "a question")])
      ]
    })

    const [finding, asked] = rowsIn("Needs You")

    expect(within(finding as HTMLElement).getByText("finding")).toBeDefined()
    expect(within(asked as HTMLElement).queryByText("finding")).toBeNull()
  })

  test("does not call a colleague who answered a finding a machine", () => {
    // Found live: a finding Devin opened and a person answered drew that person's
    // login with a chip reading "bot" against it.
    showing({ threads: [aThread("t1", [aComment(machine, "possible null"), aComment(dana, "checked")])] })

    const row = rowsIn("Needs You")[0] as HTMLElement

    expect(row.textContent).toContain("dana")
    expect(within(row).queryByText("bot")).toBeNull()
  })

  /*
   * Found live on `octo-org/octo-repo#1787`: two findings Devin opened and
   * the reader answered drew a bot glyph, the reader's own login beside it, and
   * the reader's own reply as the sentence. Every word of it was about the one
   * party who was not being waited on.
   */
  /*
   * The class rather than a word, motion having no other surface: the glyph is
   * hidden from a reader being read to, because the heading beside it already
   * says "Running" in text.
   */
  const turning = (name: string) =>
    screen.getByRole("button", { name: new RegExp(name) }).querySelector(".t-rotate") !== null

  test("turns the Running heading while a job is turning", () => {
    showing({ checks: [aCheck("build", "running")] })

    expect(turning("Running")).toBe(true)
  })

  /*
   * Queued is not running: their own word for a job that has not started, and the
   * dot is the glyph this interface already draws it with on a check row.
   */
  test("rests it where every job in it is queued rather than started", () => {
    showing({ checks: [aCheck("build", "queued")] })

    expect(turning("Running")).toBe(false)
  })

  test("does not name the reader on a finding they answered, nobody waiting on them", () => {
    showing({ threads: [aThread("t1", [aComment(machine, "possible null"), aComment(viewer, "checked, it cannot be")])] })

    const row = rowsIn("Needs You")[0] as HTMLElement

    expect(row.textContent).not.toContain(VIEWER)
  })

  /*
   * A login 25 characters long — `devin-ai-integration[bot]` — in a column 290
   * wide left the finding truncated at about 30. Three things said a machine
   * found this, and the one that took the width said it worst.
   */
  test("leaves a machine's login off a finding, the glyph and the chip having said it", () => {
    showing({ threads: [aThread("t1", [aComment(machine, "possible null"), aComment(viewer, "checked")])] })

    const row = rowsIn("Needs You")[0] as HTMLElement

    expect(row.textContent).not.toContain("copilot")
    expect(row.textContent).toContain("possible null")
  })

  test("leaves it off an unanswered finding too, the two being one kind of row", () => {
    showing({ threads: [aThread("t1", [aComment(machine, "possible null")])] })

    expect((rowsIn("Needs You")[0] as HTMLElement).textContent).not.toContain("copilot")
  })

  test("says the finding rather than the reader's own answer to it", () => {
    showing({ threads: [aThread("t1", [aComment(machine, "possible null"), aComment(viewer, "checked, it cannot be")])] })

    const row = rowsIn("Needs You")[0] as HTMLElement

    expect(row.textContent).toContain("possible null")
    expect(row.textContent).not.toContain("checked, it cannot be")
  })

  describe("settling a finding from the row", () => {
    const answered = {
      threads: [aThread("t1", [aComment(machine, "possible null"), aComment(viewer, "checked")])]
    }

    const showingWith = (onSettle: (id: string) => Effect.Effect<unknown, unknown>) =>
      render(<ControlCenter snapshot={aSnapshot(answered)} onSettle={onSettle} />)

    test("names the thread GitHub is to resolve", async () => {
      const asked: Array<string> = []
      showingWith((id) => Effect.sync(() => void asked.push(id)))

      await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

      expect(asked).toEqual(["t1"])
    })

    test("moves the row to Settled once GitHub has taken it", async () => {
      showingWith(() => Effect.void)

      await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

      expect(screen.queryByRole("list", { name: "Needs You" })).toBeNull()
      expect(screen.getByRole("button", { name: /Settled/ })).toBeDefined()
    })

    /*
     * A row that moved to Settled on a write GitHub declined would be the panel
     * lying about the one thing it is for.
     */
    test("leaves the row where it is where GitHub refused", async () => {
      showingWith(() => Effect.fail(new Error("Thread not found")))

      await userEvent.click(screen.getByRole("button", { name: "Resolve" }))

      expect(rowsIn("Needs You").length).toBe(1)
    })

    test("offers nothing to press where nobody handed the panel a way to do it", () => {
      showing(answered)

      expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull()
    })

    test("offers it on a finding and not on a colleague's thread", () => {
      showingWith(() => Effect.void)
      cleanup()
      render(
        <ControlCenter
          snapshot={aSnapshot({ threads: [aThread("t2", [aComment(dana, "a question")])] })}
          onSettle={() => Effect.void}
        />
      )

      expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull()
    })
  })

  test("says what a machine wrote, not the bookkeeping it wrote first", () => {
    // Devin opens every finding with an HTML comment carrying its own job id, and
    // seven rows of a live panel read as JSON because of it.
    showing({
      threads: [
        aThread("t1", [
          aComment(machine, '<!-- devin-review-comment {"id": "ANALYSIS_0001"} -->\n\nThis can be null.')
        ])
      ]
    })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("This can be null.")
    expect(rowsIn("Needs You")[0]?.textContent).not.toContain("devin-review-comment")
  })

  test("reads the marks of a headline rather than saying them out", () => {
    showing({
      threads: [aThread("t1", [aComment(machine, "🔍 **Envelope has no counterpart** for `entryId`")])]
    })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("Envelope has no counterpart for entryId")
  })

  test("counts what landed since the reader last reviewed, which is their re-read", () => {
    showing(reviewedThen(["bbb", "ccc"]))

    expect(rowsIn("Needs You")[0]?.textContent).toContain("2 commits")
    expect(rowsIn("Needs You")[0]?.textContent).toContain("since you last reviewed")
  })

  test("says one commit in the singular, a row that cannot count being worth nothing", () => {
    showing(reviewedThen(["bbb"]))

    expect(within(rowsIn("Needs You")[0] as HTMLElement).getByText("1 commit")).toBeDefined()
  })

  test("owes a first-time reader no delta, the whole pull request being their delta", () => {
    showing({ commits: [aCommit("aaa"), aCommit("bbb")] })

    expect(screen.getByText("Nothing is owed here")).toBeDefined()
  })

  test("says the branch was rewritten where the reader's review no longer anchors", async () => {
    // GitHub answers this with "We went looking everywhere, but couldn't find
    // those commits", which leaves the reader to work out that they were rebased
    // out from under and owe the whole pull request a second reading.
    showing({
      commits: [aCommit("bbb"), aCommit("ccc")],
      viewer: { login: VIEWER, lastReviewPoint: Option.some("aaa") }
    })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("Rewritten")
  })

  test("owes nothing where the reader's review point is the newest commit", () => {
    showing({
      commits: [aCommit("aaa"), aCommit("bbb")],
      viewer: { login: VIEWER, lastReviewPoint: Option.some("bbb") }
    })

    expect(screen.getByText("Nothing is owed here")).toBeDefined()
  })

  test("keeps the files a reader has not ticked out of it, a bookmark being nobody's debt", () => {
    // Thirty un-ticked files came out as thirty rows and pushed the failing check
    // and the two questions off the bottom of the panel. Nothing in GitHub's
    // community discussions asks to be shown them, and the tree beside this marks
    // every one of them already.
    showing({ files: ["a", "b", "c", "d"].map((one) => aFile(`src/${one}.ts`)) })

    expect(screen.getByText("Nothing is owed here")).toBeDefined()
  })

  test("says the branch is behind the branch it would land on, by name", () => {
    showing({
      baseBranch: "main",
      merge: {
        ...aSnapshot().merge,
        update: Option.some({ how: "MERGE", mayUpdate: true, refusal: Option.none() })
      }
    })

    expect(rowsIn("Needs You")[0]?.textContent).toContain("main")
  })

  test("opens the file a thread hangs off, a remark about a line being about that file", async () => {
    const opened: Array<string> = []
    showing(
      { threads: [aThread("t1", [aComment(dana)], false, anchoredAt("src/spin.ts", 12))] },
      (path) => opened.push(path)
    )

    await userEvent.click(within(rowsIn("Needs You")[0] as HTMLElement).getByRole("button"))

    expect(opened).toEqual(["src/spin.ts"])
  })

  test("offers no press where there is no file to open, rather than a button that does nothing", () => {
    showing({ threads: [aThread("t1", [aComment(dana)])] }, () => {})

    expect(within(rowsIn("Needs You")[0] as HTMLElement).queryByRole("button")).toBeNull()
  })

  test("says so plainly where a pull request owes nobody anything", () => {
    showing({})

    expect(screen.getByText("Nothing is owed here")).toBeDefined()
  })

  test("says so where everything on it is settled, which is the ordinary done state", () => {
    // Found on ghpro-scratch#9, a pull request with one passing check and nothing
    // else at all: the panel drew a folded "Settled 1" and no words, leaving the
    // reader to work out the answer from the Courts that were absent. Nearly every
    // repository puts a green check on every pull request, so a sentence that
    // waits for every Court to be empty is a sentence nobody reads.
    showing({ checks: [aCheck("test", "succeeded")] })

    expect(screen.getByText("Nothing is owed here")).toBeDefined()
    expect(screen.getByRole("button", { name: /Settled/ })).toBeDefined()
  })

  test("keeps the sentence away once anything at all is owed", () => {
    showing({ checks: [aCheck("test", "failed"), aCheck("lint", "succeeded")] })

    expect(screen.queryByText("Nothing is owed here")).toBeNull()
  })

  test("opens the oldest commit the reader has not seen, which is where reading resumes", async () => {
    const opened: Array<string> = []
    showing(reviewedThen(["bbb", "ccc"]), undefined, (sha) => opened.push(sha))

    await userEvent.click(screen.getByRole("button", { name: /2 commits/ }))

    expect(opened).toEqual(["bbb"])
  })

  test("offers no press on a rewritten anchor, the commit it pointed at being the thing that is gone", () => {
    showing(
      {
        commits: [aCommit("bbb")],
        viewer: { login: VIEWER, lastReviewPoint: Option.some("aaa") }
      },
      undefined,
      () => {}
    )

    expect(within(rowsIn("Needs You")[0] as HTMLElement).queryByRole("button")).toBeNull()
  })
})
