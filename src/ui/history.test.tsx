import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { CommitList, Day, History as Read, Landed } from "../domain/commitList"
import { History } from "./History"

afterEach(cleanup)

const person = (login: string): Landed["authors"][number] => ({
  login,
  isAutomated: false,
  faceUrl: Option.some(`https://avatars.test/${login}.png`)
})

const landed = (sha: string, headline: string, over: Partial<Landed> = {}): Landed => ({
  sha: sha.padEnd(40, "0"),
  abbreviatedSha: sha.slice(0, 7),
  headline,
  bodyHtml: Option.none(),
  authors: [person("flazouh")],
  committer: Option.none(),
  pullRequest: Option.none(),
  createdAt: "2026-08-01T10:00:00.000+02:00",
  mark: Option.none(),
  stat: Option.none(),
  ...over
})

const day = (title: string, commits: ReadonlyArray<Landed>): Day => ({ title, commits })

const list: CommitList = {
  repo: { owner: "flazouh", repo: "githubpro" },
  branch: Option.some("main"),
  search: ""
}

const read = (over: Partial<Read> = {}): Read => ({
  branch: "main",
  days: [
    day("Aug 2, 2026", [landed("3f12934", "The window's view follows the interface")]),
    day("Aug 1, 2026", [
      landed("4c84c54", "The window's storage, reached once"),
      landed("b7988b0", "Zoom that survives a launch")
    ])
  ],
  older: Option.none(),
  newer: Option.none(),
  rest: Option.none(),
  ...over
})

const showing = (over: Partial<Read> = {}, onGo: (path: string) => void = () => {}) =>
  render(<History history={read(over)} list={list} onGo={onGo} />)

/** Every commit on the screen, by where its row leads. */
const rows = () =>
  screen
    .getAllByRole("listitem")
    .map((row) => within(row).getAllByRole("link")[0]?.getAttribute("href"))

const one = (commit: Landed) => showing({ days: [day("Aug 2, 2026", [commit])] })

describe("a branch's commits", () => {
  test("puts each commit under the day it landed on", () => {
    showing()

    const second = screen.getByRole("region", { name: "Aug 1, 2026" })

    expect(within(second).getAllByRole("listitem")).toHaveLength(2)
    expect(within(screen.getByRole("region", { name: "Aug 2, 2026" })).getAllByRole("listitem"))
      .toHaveLength(1)
  })

  test("takes a press on a commit to that commit's own page", () => {
    showing()

    expect(rows()[0]).toBe(`/flazouh/githubpro/commit/${"3f12934".padEnd(40, "0")}`)
  })

  test("shows the abbreviated sha, which is the name a failing check calls it by", () => {
    showing()

    expect(screen.getByText("3f12934")).toBeDefined()
  })

  test("shows everybody a commit is attributed to, not the first of them", () => {
    // A commit written by a person and an agent together is most of them here.
    // A row showing one face says the wrong person wrote it half the time.
    showing({
      days: [day("Aug 2, 2026", [landed("3f12934", "Two of us", {
        authors: [person("flazouh"), person("cursoragent")]
      })])]
    })

    expect(screen.getByRole("img", { name: "flazouh" })).toBeDefined()
    expect(screen.getByRole("img", { name: "cursoragent" })).toBeDefined()
  })

  test("offers the older ones where GitHub said there are older ones", async () => {
    const went: Array<string> = []
    const who = userEvent.setup()
    showing({ older: Option.some("3f12934 34") }, (path) => went.push(path))

    await who.click(screen.getByRole("link", { name: "Older" }))

    expect(went).toEqual(["/flazouh/githubpro/commits/main?after=3f12934+34"])
  })

  test("offers no way back from the newest page, which is where a reader arrives", () => {
    showing()

    expect(screen.queryByRole("link", { name: "Newer" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Older" })).toBeNull()
  })

  test("goes back the way it came on a later page", () => {
    showing({ newer: Option.some("3f12934 0") })

    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe(
      "/flazouh/githubpro/commits/main?before=3f12934+0"
    )
  })

  test("says the branch is empty rather than drawing nothing", () => {
    showing({ days: [] })

    expect(screen.getByText(/no commits/)).toBeDefined()
  })

  test("leaves a modified press to GitHub, since the address is a real one", async () => {
    const went: Array<string> = []
    const who = userEvent.setup()
    showing({ older: Option.some("3f12934 34") }, (path) => went.push(path))

    await who.keyboard("{Meta>}")
    await who.click(screen.getByRole("link", { name: "Older" }))
    await who.keyboard("{/Meta}")

    expect(went).toEqual([])
  })
})

describe("how big a commit is", () => {
  test("says the files it touched and the lines it moved", () => {
    one(landed("3f12934", "Quiet corners", { stat: Option.some({ files: 5, added: 279, removed: 28 }) }))

    expect(screen.getByText("5 files")).toBeDefined()
    expect(screen.getByText("+279")).toBeDefined()
    expect(screen.getByText("−28")).toBeDefined()
  })

  test("says one file rather than 1 files", () => {
    one(landed("3f12934", "One line", { stat: Option.some({ files: 1, added: 1, removed: 0 }) }))

    expect(screen.getByText("1 file")).toBeDefined()
  })

  test("says nothing at all where the size has not been read", () => {
    // A commit nobody has counted yet and a commit that changed nothing are
    // different facts. Drawing +0 −0 for the first is the mistake worth guarding.
    one(landed("3f12934", "Not counted yet"))

    expect(screen.queryByText(/files?$/)).toBeNull()
    expect(screen.queryByText("+0")).toBeNull()
  })

  test("reads the whole size out to somebody who cannot see the colours", () => {
    one(landed("3f12934", "Quiet corners", { stat: Option.some({ files: 2, added: 10, removed: 3 }) }))

    expect(screen.getByText("2 files")).toBeDefined()
    expect(screen.getByLabelText("10 added, 3 removed")).toBeDefined()
  })
})

describe("what else a row can say about a commit", () => {
  test("links the pull request it landed as, where the message says so", () => {
    one(landed("3f12934", "Quiet corners (#412)", { pullRequest: Option.some(412) }))

    expect(screen.getByRole("link", { name: "#412" }).getAttribute("href")).toBe(
      "/flazouh/githubpro/pull/412"
    )
  })

  test("says nothing about one on a commit pushed straight to the branch", () => {
    one(landed("3f12934", "Tidy the gate stylesheet"))

    expect(screen.queryByRole("link", { name: /^#/ })).toBeNull()
  })

  test("shows the committer where GitHub says that is somebody else", () => {
    // A rebase, a cherry-pick, a patch applied on somebody's behalf. On the
    // ordinary commit the two are the same and this row shows one face.
    one(
      landed("3f12934", "Somebody else's patch", {
        authors: [person("flazouh")],
        committer: Option.some(person("octo-repo"))
      })
    )

    expect(screen.getByRole("img", { name: "flazouh" })).toBeDefined()
    expect(screen.getByRole("img", { name: "octo-repo, who committed it" })).toBeDefined()
  })

  test("shows one face for the ordinary commit, whose author committed it", () => {
    one(landed("3f12934", "An ordinary commit"))

    expect(screen.getAllByRole("img", { name: /flazouh/ })).toHaveLength(1)
  })

  test("keeps the whole row to one line, which is what a list is read down", () => {
    // Everything a row says lives on the line the sentence is on. Two lines is
    // half the commits on a screen, and this page is a page of commits.
    one(
      landed("3f12934", "Quiet corners (#412)", {
        pullRequest: Option.some(412),
        stat: Option.some({ files: 2, added: 10, removed: 3 })
      })
    )

    const line = screen.getByRole("listitem")

    // The row is the line: one grid, every fact a cell of it, nothing stacked.
    expect(line.className).toContain("grid")
    expect(within(line).getByText("Quiet corners (#412)")).toBeDefined()
    expect(within(line).getByText("3f12934")).toBeDefined()
    expect(within(line).getByText("+10")).toBeDefined()
  })

  test("gives every row of a page the same columns, so the facts line up down it", () => {
    // The whole point of the tracks. A row whose neighbour has a fact it lacks
    // still keeps the room for it, or every edge on the page zig-zags.
    showing({
      days: [
        day("Aug 2, 2026", [
          landed("3f12934", "One with a number", { pullRequest: Option.some(412) }),
          landed("aa11bb2", "One pushed straight to the branch")
        ])
      ]
    })

    const [first, second] = screen.getAllByRole("listitem")

    expect((first as HTMLElement).style.gridTemplateColumns).toBe(
      (second as HTMLElement).style.gridTemplateColumns
    )
  })

  test("draws how the checks came out, in GitHub's own words", () => {
    one(
      landed("3f12934", "A tested commit", {
        mark: Option.some({
          checks: Option.some({ state: "passing", said: "251 / 252 checks OK" }),
          verified: false,
          comments: 0
        })
      })
    )

    expect(screen.getByLabelText("251 / 252 checks OK")).toBeDefined()
  })

  test("draws no check mark at all until the second read has answered", () => {
    // Absent is not passing. A green tick on a commit nothing has answered about
    // is the one mistake this column must not make.
    one(landed("3f12934", "A commit nobody has answered about yet"))

    expect(screen.queryByLabelText(/checks/)).toBeNull()
  })

  test("draws no check mark where GitHub answered and nothing had run", () => {
    one(
      landed("3f12934", "An untested commit", {
        mark: Option.some({ checks: Option.none(), verified: false, comments: 0 })
      })
    )

    expect(screen.queryByLabelText(/checks/)).toBeNull()
  })

  test("marks a commit whose signature GitHub could verify", () => {
    one(
      landed("3f12934", "A signed commit", {
        mark: Option.some({ checks: Option.none(), verified: true, comments: 0 })
      })
    )

    expect(screen.getByLabelText("Verified signature")).toBeDefined()
  })

  test("counts the comments where anybody left one, and stays quiet where nobody did", () => {
    one(
      landed("3f12934", "A discussed commit", {
        mark: Option.some({ checks: Option.none(), verified: false, comments: 3 })
      })
    )

    expect(screen.getByLabelText("3 comments")).toBeDefined()

    cleanup()
    one(
      landed("4c84c54", "An undiscussed commit", {
        mark: Option.some({ checks: Option.none(), verified: false, comments: 0 })
      })
    )

    expect(screen.queryByLabelText(/comments/)).toBeNull()
  })

  test("puts the whole sha on the clipboard, which is what a sha is copied for", async () => {
    // Set up first, then the stub: `userEvent.setup()` installs a clipboard of
    // its own, and doing these the other way round writes into theirs.
    const who = userEvent.setup()
    const copied: Array<string> = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (said: string) => {
          copied.push(said)
          return Promise.resolve()
        }
      }
    })

    one(landed("3f12934", "A commit to quote elsewhere"))

    await who.click(screen.getByRole("button", { name: "Copy the full sha" }))

    // The whole forty characters, not the seven on the screen: a seven character
    // sha pasted into a command is one that stops working the day it collides.
    await waitFor(() => expect(copied).toEqual(["3f12934".padEnd(40, "0")]))
  })

  test("shows the rest of the message where one was written, once it is asked for", async () => {
    const who = userEvent.setup()
    one(
      landed("3f12934", "A commit with more to say", {
        bodyHtml: Option.some("<p>And here is the rest of it.</p>")
      })
    )

    expect(screen.queryByText("And here is the rest of it.")).toBeNull()

    await who.click(screen.getByRole("button", { name: "Show the rest of the message" }))

    expect(screen.getByText("And here is the rest of it.")).toBeDefined()
  })

  test("offers nothing to expand on a commit that is one line", () => {
    one(landed("3f12934", "One line and no more"))

    expect(screen.queryByRole("button", { name: "Show the rest of the message" })).toBeNull()
  })
})
