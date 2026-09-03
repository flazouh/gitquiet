import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  addressOf,
  answeringOf,
  courtOf,
  discussionIn,
  discussionListIn,
  listAddressOf,
  type ListedDiscussion
} from "./discussions"

const at = (path: string): string => `https://github.com${path}`

const row = (over: Partial<ListedDiscussion> = {}): ListedDiscussion => ({
  reference: { owner: "vercel", repo: "next.js", number: 70178 },
  id: "D_kwDOBC3Cis4Abtsx",
  title: "High Memory Usage by next-server process.",
  url: "/vercel/next.js/discussions/70178",
  category: { name: "Help", slug: "help", emoji: "🎓" },
  answerable: true,
  answered: false,
  locked: false,
  upvotes: 9,
  comments: 9,
  author: "ShivamArora",
  askedAt: "2024-09-17T08:29:25Z",
  participants: ["ShivamArora", "raju-sirigineedi", "teknology"],
  ...over
})

describe("what a discussion is waiting for", () => {
  test("a Question with replies and no Answer is Stale, which is 94 of 120 real rows", () => {
    expect(answeringOf(row({ answerable: true, answered: false, comments: 9 }))).toBe("stale")
  })

  test("a Question nobody has replied to is waiting for somebody to write one", () => {
    expect(answeringOf(row({ answerable: true, answered: false, comments: 0 }))).toBe("unanswered")
  })

  test("a marked Answer is an Answer whatever else is in the thread", () => {
    expect(answeringOf(row({ answerable: true, answered: true, comments: 2 }))).toBe("answered")
  })

  /*
   * Six of `vercel/next.js`'s nine categories take no answers. Their rows carry no state at all,
   * and the absence is a fact rather than a gap: an Idea is not an unanswered question.
   */
  test("a category that takes no answers is not a Question", () => {
    expect(answeringOf(row({ answerable: false, answered: false, comments: 0 }))).toBe(
      "unanswerable"
    )
    expect(answeringOf(row({ answerable: false, answered: false, comments: 40 }))).toBe(
      "unanswerable"
    )
  })
})

describe("which Court a discussion sits in", () => {
  test("Stale is Needs You, because somebody has to point at the answer already there", () => {
    expect(courtOf(row({ comments: 9 }))).toBe("needs-you")
  })

  test("a question nobody has answered is Waiting, because somebody else has to speak", () => {
    expect(courtOf(row({ comments: 0 }))).toBe("waiting")
  })

  test("an answered question is Settled", () => {
    expect(courtOf(row({ answered: true }))).toBe("settled")
  })

  test("a category that takes no answers is Settled, because nothing is owed on it", () => {
    expect(courtOf(row({ answerable: false, comments: 40 }))).toBe("settled")
  })

  /*
   * Locked beats every other reading. A locked thread with nine replies and nothing marked is
   * exactly the row Needs You is for, and there is nothing a reader can do to it.
   */
  test("locked is Settled even where the same row unlocked would need you", () => {
    expect(courtOf(row({ locked: true, comments: 9 }))).toBe("settled")
    expect(courtOf(row({ locked: true, comments: 0 }))).toBe("settled")
  })

  test("Running is never returned, because no machine works on a discussion", () => {
    const every = [
      row({ comments: 9 }),
      row({ comments: 0 }),
      row({ answered: true }),
      row({ answerable: false }),
      row({ locked: true })
    ]

    expect(every.map(courtOf)).not.toContain("running")
  })
})

describe("reading a discussion list out of an address", () => {
  test("reads a repository's whole list", () => {
    const found = discussionListIn(at("/vercel/next.js/discussions"))

    expect(Option.isSome(found)).toBe(true)
    expect(Option.getOrThrow(found).repo).toEqual({ owner: "vercel", repo: "next.js" })
    expect(Option.getOrThrow(found).category).toEqual(Option.none())
    expect(Option.getOrThrow(found).query).toBe("")
    expect(Option.getOrThrow(found).page).toBe(1)
  })

  test("reads one category, which their own sidebar links rather than queries", () => {
    const found = discussionListIn(at("/vercel/next.js/discussions/categories/show-and-tell"))

    expect(Option.getOrThrow(found).category).toEqual(Option.some("show-and-tell"))
  })

  test("unescapes a category slug, since a slug can carry one", () => {
    const found = discussionListIn(at("/acme/tools/discussions/categories/q%26a"))

    expect(Option.getOrThrow(found).category).toEqual(Option.some("q&a"))
  })

  /*
   * Their filter controls write `discussions_q`, not `q`. Reading the wrong one would draw the
   * whole list under a heading that says the reader had filtered it.
   */
  test("keeps their search verbatim, under their own name for it", () => {
    const found = discussionListIn(
      at("/vercel/next.js/discussions?discussions_q=is%3Aunanswered+sort%3Atop&page=3")
    )

    expect(Option.getOrThrow(found).query).toBe("is:unanswered sort:top")
    expect(Option.getOrThrow(found).page).toBe(3)
  })

  test("falls back to the first page for a page that is not one", () => {
    for (const asked of ["0", "-2", "two", "1.5", ""]) {
      const found = discussionListIn(at(`/acme/tools/discussions?page=${asked}`))
      expect(Option.getOrThrow(found).page).toBe(1)
    }
  })

  /*
   * `/orgs/community/discussions` is where GitHub's own product feedback lives, so it is a page
   * a reader of this extension opens. Read as a repository it would be `orgs/community`, and the
   * screen would take the page over and list nothing.
   */
  test("refuses an organisation's discussions, which are not a repository's", () => {
    expect(discussionListIn(at("/orgs/community/discussions"))).toEqual(Option.none())
    expect(discussionListIn(at("/ORGS/community/discussions"))).toEqual(Option.none())
    expect(discussionListIn(at("/orgs/community/discussions/categories/discussions"))).toEqual(
      Option.none()
    )
  })

  test("refuses the neighbours that are not a list", () => {
    for (const path of [
      "/vercel/next.js/discussions/new",
      "/vercel/next.js/discussions/70178",
      "/vercel/next.js/discussions/categories",
      "/vercel/next.js/issues",
      "/vercel/next.js",
      "/vercel/next.js/discussions/categories/help/extra"
    ]) {
      expect(discussionListIn(at(path))).toEqual(Option.none())
    }
  })

  test("refuses another host that happens to end in the same word", () => {
    expect(discussionListIn("https://example.com/vercel/next.js/discussions")).toEqual(
      Option.none()
    )
    expect(discussionListIn("not an address at all")).toEqual(Option.none())
  })
})

describe("reading one discussion out of an address", () => {
  test("reads the repository and the number", () => {
    expect(discussionIn(at("/vercel/next.js/discussions/70178"))).toEqual(
      Option.some({ owner: "vercel", repo: "next.js", number: 70178 })
    )
  })

  test("keeps whatever the address carried beside it", () => {
    expect(
      discussionIn(at("/vercel/next.js/discussions/70178?sort=top#discussioncomment-11004713"))
    ).toEqual(Option.some({ owner: "vercel", repo: "next.js", number: 70178 }))
  })

  /*
   * `Number("new")` is NaN and `Number("")` is 0. Either would reach a read as an address GitHub
   * answers 404 to, on the one page where GitHub draws a form.
   */
  test("refuses the raise form, which sits where a number goes", () => {
    expect(discussionIn(at("/vercel/next.js/discussions/new"))).toEqual(Option.none())
    expect(discussionIn(at("/vercel/next.js/discussions/new?category=help"))).toEqual(Option.none())
  })

  test("refuses anything that is not one of their numbers", () => {
    for (const last of ["0", "12abc", "-4", "1.5", "%20"]) {
      expect(discussionIn(at(`/acme/tools/discussions/${last}`))).toEqual(Option.none())
    }
  })

  test("refuses an organisation's discussion and the list above it", () => {
    expect(discussionIn(at("/orgs/community/discussions/88425"))).toEqual(Option.none())
    expect(discussionIn(at("/vercel/next.js/discussions"))).toEqual(Option.none())
  })
})

describe("writing the addresses back", () => {
  test("a discussion's own address is the one it was read from", () => {
    const path = "/vercel/next.js/discussions/70178"

    expect(addressOf(Option.getOrThrow(discussionIn(at(path))))).toBe(path)
  })

  test("a list's address is theirs, all of it or one category", () => {
    const repo = { owner: "vercel", repo: "next.js" }

    expect(listAddressOf(repo)).toBe("/vercel/next.js/discussions")
    expect(listAddressOf(repo, Option.some("show-and-tell"))).toBe(
      "/vercel/next.js/discussions/categories/show-and-tell"
    )
  })

  test("a category that needs escaping comes back escaped, and reads back the same", () => {
    const written = listAddressOf({ owner: "acme", repo: "tools" }, Option.some("q&a"))

    expect(written).toBe("/acme/tools/discussions/categories/q%26a")
    expect(Option.getOrThrow(discussionListIn(at(written))).category).toEqual(Option.some("q&a"))
  })
})
