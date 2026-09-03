import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  type Comment,
  type Counted,
  type Standing,
  collapsedMeToo,
  commentAt,
  courtOfDiscussion,
  discussionIn,
  discussionListIn,
  isMeToo,
  orgDiscussionIn,
  orgDiscussionListIn,
  orgPageOf,
  pageOf,
  perCategory,
  raisingDiscussionIn,
  unansweredAmong,
  workingAnswer
} from "./discussions"

const at = (path: string) => `https://github.com${path}`

const list = (path: string) => Option.getOrNull(discussionListIn(at(path)))

describe("the address of a repository's discussions", () => {
  test("reads the owner and the repository out of it", () => {
    expect(list("/fluentai-pro/fluentai/discussions")).toEqual({
      repo: { owner: "fluentai-pro", repo: "fluentai" },
      category: Option.none(),
      query: ""
    })
  })

  test("does not mind a trailing slash, which is how some of their links are written", () => {
    expect(list("/fluentai-pro/fluentai/discussions/")?.repo).toEqual({
      owner: "fluentai-pro",
      repo: "fluentai"
    })
  })

  test("carries their search verbatim, out of the parameter only this surface uses", () => {
    expect(list("/fluentai-pro/fluentai/discussions?discussions_q=is%3Aunanswered")?.query).toBe(
      "is:unanswered"
    )
  })

  test("does not read `q`, which on this page is somebody else's parameter", () => {
    expect(list("/fluentai-pro/fluentai/discussions?q=is%3Aopen")?.query).toBe("")
  })

  test("reads one category off the sidebar's own address", () => {
    const one = list("/fluentai-pro/fluentai/discussions/categories/q-a")

    expect(one?.repo).toEqual({ owner: "fluentai-pro", repo: "fluentai" })
    expect(one?.category).toEqual(Option.some("q-a"))
  })

  test("keeps the sidebar's category apart from one that was typed into the box", () => {
    // Their filter can express a category either way, and the two are not the same
    // arrival: one is a page the reader pressed, the other is a search they wrote.
    const typed = list("/fluentai-pro/fluentai/discussions?discussions_q=category%3AQ%26A")

    expect(typed?.category).toEqual(Option.none())
    expect(typed?.query).toBe("category:Q&A")
  })

  test("is not one discussion, which is the same address with a number on it", () => {
    expect(list("/fluentai-pro/fluentai/discussions/42")).toBeNull()
  })

  test("is not the form, which sits exactly where a number sits", () => {
    expect(list("/fluentai-pro/fluentai/discussions/new")).toBeNull()
  })

  test("is not the categories page itself, which names no category", () => {
    expect(list("/fluentai-pro/fluentai/discussions/categories")).toBeNull()
  })

  test("is not the repository's issues, which is the neighbouring tab", () => {
    expect(list("/fluentai-pro/fluentai/issues")).toBeNull()
  })

  test("is not an organisation's, which names no repository", () => {
    expect(list("/orgs/community/discussions")).toBeNull()
  })

  test("is not another site that happens to end this way", () => {
    expect(Option.getOrNull(discussionListIn("https://example.com/a/b/discussions"))).toBeNull()
  })

  test("is not an address at all", () => {
    expect(Option.getOrNull(discussionListIn("discussions"))).toBeNull()
  })
})

const one = (path: string) => Option.getOrNull(discussionIn(path))

describe("the address of one discussion", () => {
  test("reads the repository and the number", () => {
    expect(one("/fluentai-pro/fluentai/discussions/42")).toEqual({
      owner: "fluentai-pro",
      repo: "fluentai",
      number: 42
    })
  })

  test("does not mind a trailing slash", () => {
    expect(one("/fluentai-pro/fluentai/discussions/42/")?.number).toBe(42)
  })

  test("is not the list, the form, or the category page", () => {
    expect(one("/fluentai-pro/fluentai/discussions")).toBeNull()
    expect(one("/fluentai-pro/fluentai/discussions/new")).toBeNull()
    expect(one("/fluentai-pro/fluentai/discussions/categories/q-a")).toBeNull()
  })

  test("refuses a number GitHub could never have given out", () => {
    expect(one("/fluentai-pro/fluentai/discussions/0")).toBeNull()
  })

  test("is the inverse of the address this codebase builds", () => {
    const reference = { owner: "fluentai-pro", repo: "fluentai", number: 42 }

    expect(one(pageOf(reference))).toEqual(reference)
  })

  test("names one comment by the anchor GitHub gives it", () => {
    expect(commentAt({ owner: "fluentai-pro", repo: "fluentai", number: 42 }, 9001)).toBe(
      "/fluentai-pro/fluentai/discussions/42#discussioncomment-9001"
    )
  })
})

describe("the form", () => {
  const raising = (path: string) => Option.getOrNull(raisingDiscussionIn(at(path)))

  test("reads the repository", () => {
    expect(raising("/fluentai-pro/fluentai/discussions/new")?.repo).toEqual({
      owner: "fluentai-pro",
      repo: "fluentai"
    })
  })

  test("reads the category their own links open it with", () => {
    expect(raising("/fluentai-pro/fluentai/discussions/new?category=q-a")?.category).toEqual(
      Option.some("q-a")
    )
  })

  test("is nothing where no category was named", () => {
    expect(raising("/fluentai-pro/fluentai/discussions/new")?.category).toEqual(Option.none())
  })

  test("is not one discussion", () => {
    expect(raising("/fluentai-pro/fluentai/discussions/42")).toBeNull()
  })
})

describe("an organisation's discussions", () => {
  test("reads the organisation off its list", () => {
    expect(Option.getOrNull(orgDiscussionListIn(at("/orgs/community/discussions")))).toBe(
      "community"
    )
  })

  test("reads one of them, which is where this surface's own bugs are filed", () => {
    expect(Option.getOrNull(orgDiscussionIn("/orgs/community/discussions/10369"))).toEqual({
      org: "community",
      number: 10369
    })
  })

  test("is the inverse of the address this codebase builds", () => {
    const reference = { org: "community", number: 10369 }

    expect(Option.getOrNull(orgDiscussionIn(orgPageOf(reference)))).toEqual(reference)
  })

  test("is not an organisation's other pages", () => {
    expect(Option.getOrNull(orgDiscussionListIn(at("/orgs/community/repositories")))).toBeNull()
    expect(Option.getOrNull(orgDiscussionListIn(at("/orgs/community/discussions/10369")))).toBeNull()
  })

  test("is not a repository's, which the same parser must not claim", () => {
    expect(Option.getOrNull(orgDiscussionIn("/fluentai-pro/fluentai/discussions/42"))).toBeNull()
  })
})

const standing = (some: Partial<Standing>): Standing => ({
  askedByViewer: false,
  answerable: true,
  answered: false,
  closed: false,
  lastSpeaker: "nobody",
  maintainer: false,
  ...some
})

describe("which Court a discussion sits in", () => {
  test("settles a closed one whatever else was true of it", () => {
    expect(
      courtOfDiscussion(
        standing({ closed: true, askedByViewer: true, lastSpeaker: "someone-else" })
      )
    ).toBe("settled")
  })

  test("settles a question somebody has marked an answer on", () => {
    expect(courtOfDiscussion(standing({ answered: true }))).toBe("settled")
  })

  test("asks the reader to come back to their own question once somebody has replied", () => {
    expect(
      courtOfDiscussion(standing({ askedByViewer: true, lastSpeaker: "someone-else" }))
    ).toBe("needs-you")
  })

  test("does not ask them again while the last word is their own", () => {
    expect(courtOfDiscussion(standing({ askedByViewer: true, lastSpeaker: "viewer" }))).toBe(
      "waiting"
    )
  })

  test("leaves a question nobody has answered yet waiting on whoever can", () => {
    expect(courtOfDiscussion(standing({ askedByViewer: true, lastSpeaker: "nobody" }))).toBe(
      "waiting"
    )
  })

  test("hands an unanswered question to the person who can answer it", () => {
    expect(courtOfDiscussion(standing({ maintainer: true }))).toBe("needs-you")
  })

  test("does not hand them a discussion that has no answer to give", () => {
    // An announcement is not unanswered. It is not the kind of thing with an answer,
    // and a rule reading those two as one would put every announcement ever posted
    // into somebody's Court forever.
    expect(courtOfDiscussion(standing({ maintainer: true, answerable: false }))).toBe("waiting")
  })

  test("leaves somebody else's thread waiting, mentioned in it or not", () => {
    expect(courtOfDiscussion(standing({ lastSpeaker: "someone-else" }))).toBe("waiting")
  })

  test("never says a machine owes anything, because none does here", () => {
    const every: ReadonlyArray<Standing> = [
      standing({}),
      standing({ closed: true }),
      standing({ answered: true }),
      standing({ askedByViewer: true, lastSpeaker: "someone-else" }),
      standing({ maintainer: true }),
      standing({ answerable: false, maintainer: true, lastSpeaker: "viewer" })
    ]

    expect(every.map(courtOfDiscussion)).not.toContain("running")
  })
})

const row = (some: Partial<Counted>): Counted => ({
  category: "Q&A",
  answerable: true,
  answered: false,
  closed: false,
  ...some
})

describe("the size of the backlog, which their own pager cannot give", () => {
  test("counts the open questions nobody has answered", () => {
    expect(unansweredAmong([row({}), row({ answered: true }), row({})])).toBe(2)
  })

  test("does not count a discussion whose category takes no answer", () => {
    expect(unansweredAmong([row({ answerable: false, category: "Announcements" })])).toBe(0)
  })

  test("does not count one that was closed, which is a backlog that was worked", () => {
    expect(unansweredAmong([row({ closed: true })])).toBe(0)
  })

  test("counts per category, in the order the categories were met", () => {
    expect(
      perCategory([
        row({ category: "Q&A" }),
        row({ category: "Help", answered: true }),
        row({ category: "Q&A" }),
        row({ category: "Help" })
      ])
    ).toEqual([
      { category: "Q&A", unanswered: 2 },
      { category: "Help", unanswered: 1 }
    ])
  })

  test("leaves out the categories that take no answer rather than showing them cleared", () => {
    expect(perCategory([row({ category: "Announcements", answerable: false })])).toEqual([])
  })
})

describe("the agreements", () => {
  test("knows the things people write to say this too", () => {
    for (const said of ["+1", "Same here", "same issue here!!", "me too", "Any update on this?"]) {
      expect(isMeToo(said)).toBe(true)
    }
  })

  test("does not mind emoji, punctuation or case, which are one comment written three ways", () => {
    expect(isMeToo("+1 :+1:")).toBe(true)
    expect(isMeToo("Same here 👍")).toBe(true)
    expect(isMeToo("SAME HERE.")).toBe(true)
  })

  test("keeps anything that says something as well", () => {
    expect(isMeToo("same here, on macOS 15 with node 22")).toBe(false)
    expect(isMeToo("+1, and the workaround is to pin the version")).toBe(false)
  })

  test("keeps anything carrying evidence, which is the class it would hurt most to fold", () => {
    expect(isMeToo("same here\n```\nTypeError\n```")).toBe(false)
    expect(isMeToo("same https://example.com/log")).toBe(false)
    expect(isMeToo("> same here")).toBe(false)
  })

  test("keeps a comment that merely contains the words", () => {
    // A rule matching anything holding "+1" would fold a report that a counter
    // went up by one.
    expect(isMeToo("the count goes +1 every time the worker restarts")).toBe(false)
  })

  test("is not an empty comment, which is not agreement with anything", () => {
    expect(isMeToo("   ")).toBe(false)
  })
})

const comment = (id: number, author: string, body: string): Comment => ({ id, author, body })

describe("folding the agreements out of a thread", () => {
  const thread = [
    comment(1, "ana", "Does this work with pnpm?"),
    comment(2, "bo", "+1"),
    comment(3, "cy", "same here"),
    comment(4, "dee", "Yes — set the store dir first."),
    comment(5, "bo", "any update?")
  ]

  test("keeps every comment that said something, in the order it was written", () => {
    expect(collapsedMeToo(thread).said.map((one) => one.id)).toEqual([1, 4])
  })

  test("keeps who agreed, which is the fact they were reporting", () => {
    expect(collapsedMeToo(thread).agreed).toEqual(["bo", "cy"])
  })

  test("counts a person once however many times they came back", () => {
    // "+1" in March and "any update?" in July is one person waiting, and counting
    // them twice overstates the one number this exists to state.
    expect(collapsedMeToo(thread).agreed).toHaveLength(2)
  })

  test("leaves a thread with nothing to fold exactly as it was", () => {
    const said = [comment(1, "ana", "Does this work with pnpm?")]

    expect(collapsedMeToo(said)).toEqual({ said, agreed: [] })
  })
})

const weighed = (id: number, agreement: number) => ({ id, author: `who-${id}`, agreement })

describe("the comment a question was probably answered by", () => {
  test("finds the one the thread agreed with", () => {
    const found = workingAnswer({ agreement: 3, answered: false }, [
      weighed(1, 1),
      weighed(2, 12),
      weighed(3, 0)
    ])

    expect(Option.getOrNull(found)?.id).toBe(2)
  })

  test("says nothing where an answer is marked, which is GitHub's own fact", () => {
    const found = workingAnswer({ agreement: 3, answered: true }, [weighed(1, 40)])

    expect(Option.isNone(found)).toBe(true)
  })

  test("says nothing where the question is the thing being agreed with", () => {
    // Forty people upvoted the question and its best comment has two: that thread
    // has not been answered, it has been agreed with.
    const found = workingAnswer({ agreement: 40, answered: false }, [weighed(1, 2)])

    expect(Option.isNone(found)).toBe(true)
  })

  test("says nothing where two comments are tied, because that is an argument", () => {
    const found = workingAnswer({ agreement: 1, answered: false }, [weighed(1, 9), weighed(2, 9)])

    expect(Option.isNone(found)).toBe(true)
  })

  test("says nothing about a thread with no comments in it", () => {
    expect(Option.isNone(workingAnswer({ agreement: 0, answered: false }, []))).toBe(true)
  })
})
