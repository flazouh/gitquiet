import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import type { RepositoryAtWork } from "../domain/rail"
import type { Repository } from "../domain/repositories"
import { Repositories } from "./Repositories"

afterEach(cleanup)

const repository = (nameWithOwner: string, over: Partial<Repository> = {}): Repository => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false,
    ...over
  }
}

const atWork = (owner: string, repo: string, count: number, needsYou: number): RepositoryAtWork => ({
  owner,
  repo,
  name: repo,
  count,
  needsYou
})

const showing = (
  repositories: ReadonlyArray<Repository> = [
    repository("flazouh/octo-repo"),
    repository("flazouh/githubpro"),
    repository("flowline-labs/flowline")
  ],
  over: { readonly atWork?: ReadonlyArray<RepositoryAtWork>; readonly waiting?: boolean } = {}
) => render(<Repositories repositories={repositories} {...over} />)

const filter = () => screen.getByRole("searchbox", { name: "Filter your repositories" })

/**
 * The repositories on the screen, each by where its row leads.
 *
 * Where it leads rather than what it reads: the face at the head of a row falls back to the
 * owner's initial when GitHub gave no picture, and that letter is decoration rather than
 * anything the row is asking to be read.
 */
const listed = () =>
  within(screen.getByRole("list", { name: "Every repository you have" }))
    .getAllByRole("link")
    .map((row) => row.getAttribute("href"))

/**
 * The Destination that answers "which repository was it called?".
 *
 * GitHub offers ten of them in their sidebar, ranked by where the reader has been. The
 * account this was built against has a hundred and fifty-four, so the other hundred and
 * forty-four are reachable only by remembering a name well enough to type it into a search
 * that also searches the rest of GitHub. Every test below is about a reader finding one.
 */
describe("the Repositories Destination", () => {
  test("lists every repository the reader has, not the recent ones", () => {
    showing()

    expect(listed()).toEqual([
      "/flazouh/octo-repo/pulls",
      "/flazouh/githubpro/pulls",
      "/flowline-labs/flowline/pulls"
    ])
  })

  test("takes a press on a repository to its pull requests", () => {
    showing()

    expect(screen.getByRole("link", { name: /flazouh\/octo-repo/ }).getAttribute("href")).toBe(
      "/flazouh/octo-repo/pulls"
    )
  })

  test("narrows the list to what the reader has typed", async () => {
    const person = userEvent.setup()
    showing()

    await person.type(filter(), "flowl")

    expect(listed()).toEqual(["/flowline-labs/flowline/pulls"])
  })

  test("says how many of how many matched, since the rows alone cannot", async () => {
    // A count is the difference between "that word found the one I wanted" and "that word
    // found forty", which nobody is going to establish by looking at a hundred and fifty rows.
    const person = userEvent.setup()
    showing()

    expect(screen.getByText("3")).toBeDefined()

    await person.type(filter(), "flazouh")

    expect(screen.getByText("2 of 3")).toBeDefined()
  })

  test("gives the filter a name a screen reader can announce", () => {
    showing()

    expect(filter()).toBeDefined()
  })

  test("puts the reader in the filter when they press the slash", async () => {
    const person = userEvent.setup()
    showing()

    await person.keyboard("/")

    expect(document.activeElement).toBe(filter())
  })

  test("lets a slash be typed into the filter, since an address contains one", async () => {
    // The shortcut must not eat the character: this is the one list in the extension that is
    // searched by `owner/repo`, and a filter that cannot take a slash cannot take an address.
    const person = userEvent.setup()
    showing()

    await person.type(filter(), "flazouh/octo-repo")

    expect(listed()).toEqual(["/flazouh/octo-repo/pulls"])
  })

  test("empties the filter when the reader presses escape", async () => {
    const person = userEvent.setup()
    showing()

    await person.type(filter(), "flowl")
    await person.keyboard("{Escape}")

    expect(listed()).toHaveLength(3)
    expect((filter() as HTMLInputElement).value).toBe("")
  })

  test("shows an owner's face beside the name and never instead of it", () => {
    // A face is recognised rather than read, which is what makes a long list scannable — but
    // it is decoration, so the name stays in text and the picture is silent.
    showing([
      repository("flazouh/octo-repo", { faceUrl: Option.some("https://avatars.test/flazouh.png") })
    ])

    const row = screen.getByRole("link", { name: /flazouh\/octo-repo/ })
    const face = row.querySelector("img")

    expect(face?.getAttribute("src")).toBe("https://avatars.test/flazouh.png")
    expect(face?.getAttribute("alt")).toBe("")
    expect(within(row).getByText("flazouh/octo-repo")).toBeDefined()
  })

  test("draws no broken picture for an owner GitHub gave no face for", () => {
    showing([repository("flazouh/octo-repo")])

    expect(screen.getByRole("link", { name: /flazouh\/octo-repo/ }).querySelector("img")).toBeNull()
  })

  test("says a private repository is private, in words rather than in a colour", () => {
    showing([repository("flazouh/octo-repo", { isPrivate: true }), repository("flazouh/githubpro")])

    const row = screen.getByRole("link", { name: /flazouh\/octo-repo/ })

    expect(within(row).getByText("Private")).toBeDefined()
    expect(
      within(screen.getByRole("link", { name: /githubpro/ })).queryByText("Private")
    ).toBeNull()
  })

  test("says which repositories the reader has work in, and whose move it is", () => {
    showing(undefined, { atWork: [atWork("flazouh", "octo-repo", 3, 2)] })

    const row = screen.getByRole("link", { name: /flazouh\/octo-repo/ })

    expect(within(row).getByText("3 open")).toBeDefined()
    expect(within(row).getByText("2 your move")).toBeDefined()
    expect(within(screen.getByRole("link", { name: /githubpro/ })).queryByText(/open/)).toBeNull()
  })

  test("offers a way back when a filter matches nothing", async () => {
    // A reader who has narrowed to nothing has lost the list, and the box they narrowed it
    // with is above a hundred and fifty rows that are no longer there to remind them.
    const person = userEvent.setup()
    showing()

    await person.type(filter(), "nothing like this")
    expect(screen.getByText("Nothing matches that.", { exact: false })).toBeDefined()

    await person.click(screen.getByRole("button", { name: "Clear the filter" }))

    expect(listed()).toHaveLength(3)
  })

  test("says it is still reading when there is nothing on the screen yet", () => {
    showing([], { waiting: true })

    expect(screen.getByRole("status").textContent).toContain("Still reading")
    expect(screen.queryByText(/no repositories/)).toBeNull()
  })

  test("says there are none once the read has landed and there were none", () => {
    // Told apart from the wait deliberately: "nothing here" and "not read yet" look identical
    // on the screen and mean opposite things to somebody deciding whether to wait.
    showing([])

    expect(screen.getByText(/no repositories/)).toBeDefined()
    expect(screen.queryByRole("status")).toBeNull()
  })
})
