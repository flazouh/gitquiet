import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { answeringOf, courtOf, type Answering } from "../domain/discussions"
import {
  categoriesOnPage,
  discussionsOnPage,
  hasMoreAfter,
  isKeptDiscussions
} from "./discussionsList"

/*
 * `vercel/next.js/discussions` as GitHub served it on 2026-09-03, signed out: twenty-five rows
 * across five of its nine categories, one of them answered. The scripts, the stylesheets, the
 * icon geometry, the tooltips, the marketing header and footer and every analytics attribute are
 * stripped, because no parser reads them and they were 320KB of the 547KB. Every element and
 * attribute a parser touches is theirs, unedited.
 */
const real = await Bun.file("tests/fixtures/discussionsList.html").text()

/*
 * The same list filtered to `is:locked`, recorded the same day. Their default list carries closed
 * rows but no locked one, and locking is the second of the two facts that beat every other
 * reading of a row: a locked question with three replies and nothing marked is exactly the row
 * Needs You exists for, and there is nothing anybody can do to it. It is also the row GitHub
 * draws without a vote button, which is what this fixture caught.
 */
const shut = await Bun.file("tests/fixtures/discussionsLocked.html").text()

const rows = discussionsOnPage(real)

const numbered = (number: number) => rows.find((one) => one.reference.number === number)

describe("reading their list page", () => {
  test("finds every row on it", () => {
    expect(rows).toHaveLength(25)
  })

  test("reads the newest row's facts as their page prints them", () => {
    const first = rows[0]

    expect(first?.reference).toEqual({
      home: { kind: "repository", owner: "vercel", repo: "next.js" },
      number: 98240
    })
    expect(first?.id).toBe("10745082")
    expect(first?.title).toBe(
      "Best pattern for sharing server-fetched data across multiple Client Components in App Router?"
    )
    expect(first?.url).toBe("/vercel/next.js/discussions/98240")
    expect(first?.author).toBe("1minikadam")
    expect(first?.askedAt).toBe("2026-09-03T21:25:27Z")
    expect(first?.upvotes).toBe(1)
    expect(first?.comments).toBe(2)
  })

  /*
   * The emoji is the maintainer's own and there is no Octicon that means "Turbopack error
   * report". The name is read off their category link rather than off the emoji box beside it.
   */
  test("reads the category off their own link, emoji and all", () => {
    expect(rows[0]?.category).toEqual({
      name: "Feedback",
      slug: "feedback",
      emoji: { kind: "text", text: "💬" }
    })
    expect(numbered(98177)?.category).toEqual({
      name: "App Router",
      slug: "app-router",
      emoji: { kind: "text", text: "🏎️" }
    })
  })

  /*
   * `:shipit:` is a picture rather than a character, so GitHub draws it as an `<img>` and not as
   * a `g-emoji`. A read that knew only about the second left `vercel/next.js`'s Show and tell
   * rows with a blank where every other row has its picture.
   */
  test("reads a category whose emoji is one of GitHub's own, which is an image", () => {
    const shown = numbered(10640)?.category

    expect(shown?.name).toBe("Show and tell")
    expect(shown?.emoji).toEqual({
      kind: "image",
      url: "https://github.githubassets.com/assets/shipit-ee78ea3eb431.png",
      name: "shipit"
    })
  })

  /*
   * Their page draws the avatar stack twice, once for a wide window and once for a narrow one,
   * and only the wide copy labels the images. Reading both would name everybody twice.
   */
  test("names each participant once, though their page draws the stack twice", () => {
    expect(rows[0]?.participants.map((one) => one.login)).toEqual([
      "1minikadam",
      "GafelSon",
      "huklaa"
    ])
  })

  /* A face as well as a name, because the row draws the stack rather than listing it. */
  test("keeps the face GitHub drew beside each name", () => {
    const first = rows[0]?.participants[0]

    expect(Option.getOrThrow(first?.faceUrl ?? Option.none())).toContain("avatars")
  })
})

describe("the state their row spells and the state it does not", () => {
  test("reads the one answered row on the page", () => {
    const answered = numbered(98177)

    expect(answered?.answerable).toBe(true)
    expect(answered?.answered).toBe(true)
    expect(answeringOf(answered!)).toBe("answered")
  })

  /*
   * Six of the nine categories take no answers, so their rows print neither word. The absence is
   * the fact rather than a gap in the read: an Idea is not an unanswered question, and reading it
   * as one would put nine rows of this page under a heading about somebody owing an answer.
   */
  test("a row in a category that takes no answers is not a Question", () => {
    const feedback = rows[0]

    expect(feedback?.answerable).toBe(false)
    expect(feedback?.answered).toBe(false)
    expect(answeringOf(feedback!)).toBe("unanswerable")
  })

  /*
   * The census this whole screen exists for, counted off one real page. Fifteen of the sixteen
   * Questions have somebody's reply in them and nothing marked, and GitHub draws all fifteen with
   * the same grey outlined check it draws on a question nobody has touched.
   */
  test("fifteen of the sixteen Questions on this page are Stale", () => {
    const census: Record<Answering, number> = {
      answered: 0,
      stale: 0,
      unanswered: 0,
      unanswerable: 0
    }
    for (const one of rows) census[answeringOf(one)] += 1

    expect(census).toEqual({ answered: 1, stale: 15, unanswered: 0, unanswerable: 9 })
  })

  /*
   * Fourteen and not fifteen, because one of the Stale ones was closed. Closing is the only
   * thing on this page that takes a row out of Needs You without answering it.
   */
  test("so Needs You holds fourteen of the twenty-five rows, and Running holds none", () => {
    const courts = rows.map(courtOf)

    expect(courts.filter((one) => one === "needs-you")).toHaveLength(14)
    expect(courts.filter((one) => one === "settled")).toHaveLength(11)
    expect(courts.filter((one) => one === "waiting")).toHaveLength(0)
    expect(courts.filter((one) => one === "running")).toHaveLength(0)
  })

  /*
   * Their default list is not "open discussions". Three of these twenty-five are closed, and one
   * of the three is a Stale Question that would otherwise be the first thing on the screen.
   */
  test("three rows of their default list are closed, and none is locked", () => {
    expect(rows.filter((one) => one.closed).map((one) => one.reference.number)).toEqual([
      97161, 98207, 64435
    ])
    expect(rows.some((one) => one.locked)).toBe(false)
  })
})

describe("the two words that end a discussion", () => {
  const shutRows = discussionsOnPage(shut)

  test("finds every row of their locked list", () => {
    expect(shutRows).toHaveLength(25)
    expect(shutRows.every((one) => one.locked)).toBe(true)
  })

  /*
   * A locked row has no vote button. GitHub puts a lock in the pill where the arrow and the count
   * go, so the id and the count go with it, and a read that insisted on the id lost all
   * twenty-five of these rows.
   */
  test("a locked row keeps its place though GitHub gives it no vote button", () => {
    expect(shutRows.every((one) => one.id === "")).toBe(true)
    expect(shutRows.every((one) => one.upvotes === 0)).toBe(true)
    expect(shutRows[0]?.title).toBe("Why remove ViewTransition?")
  })

  /*
   * Their row prints both words rather than replacing one with the other: "· Closed ·
   * Unanswered". So a closed Question is still a Question with no answer, and the Court is where
   * the two facts meet.
   */
  test("a closed Question keeps its Answering and loses its Court", () => {
    const both = shutRows.find((one) => one.reference.number === 97925)

    expect(both?.closed).toBe(true)
    expect(both?.answerable).toBe(true)
    expect(both?.answered).toBe(false)
    expect(both?.comments).toBe(3)
    expect(answeringOf(both!)).toBe("stale")
    expect(courtOf(both!)).toBe("settled")
  })

  test("a locked Question that nobody closed is still locked, and still Settled", () => {
    const open = shutRows.find((one) => one.reference.number === 97437)

    expect(open?.closed).toBe(false)
    expect(open?.locked).toBe(true)
    expect(courtOf(open!)).toBe("settled")
  })

  test("a closed row in a category that takes no answers carries Closed and no answer word", () => {
    const idea = shutRows.find((one) => one.reference.number === 93001)

    expect(idea?.closed).toBe(true)
    expect(idea?.answerable).toBe(false)
    expect(idea?.comments).toBe(0)
  })
})

describe("the rest of the page", () => {
  /*
   * Read off their own sidebar rather than collected from the rows. Five of the nine categories
   * have a row on this page, and a category nobody has posted in is still a category.
   */
  test("names every category their sidebar carries, not only the ones with a row", () => {
    const categories = categoriesOnPage(real)

    expect(categories.map((one) => one.slug)).toEqual([
      "app-router",
      "feedback",
      "help",
      "ideas",
      "polls",
      "rfc",
      "security",
      "show-and-tell",
      "turbopack-error-report"
    ])
    expect(categories[0]).toEqual({
      name: "App Router",
      slug: "app-router",
      emoji: { kind: "text", text: "🏎️" }
    })
  })

  /*
   * Their label element and not the anchor's whole text, which holds the emoji and their
   * indentation as well. Reading the anchor named every category after its picture.
   */
  test("a category name is the name, with the picture left out of it", () => {
    const named = categoriesOnPage(real).map((one) => one.name)

    expect(named).not.toContain("🏎️ App Router")
    expect(named).toContain("Turbopack Error Report")
  })

  /** The sidebar draws GitHub's own emoji as an image there too, exactly as the rows do. */
  test("a category whose emoji is an image is read as one in the sidebar as well", () => {
    const shown = categoriesOnPage(real).find((one) => one.slug === "show-and-tell")

    expect(shown?.name).toBe("Show and tell")
    expect(shown?.emoji.kind).toBe("image")
  })

  test("says there is another page, off their own next link", () => {
    expect(hasMoreAfter(real)).toBe(true)
  })
})

describe("coming back empty rather than wrong", () => {
  test("a page that has stopped looking like this yields nothing", () => {
    expect(discussionsOnPage("<html><body><p>nothing here</p></body></html>")).toEqual([])
    expect(categoriesOnPage("<html><body></body></html>")).toEqual([])
    expect(hasMoreAfter("<html><body></body></html>")).toBe(false)
  })

  test("a row with no heading link is skipped rather than guessed at", () => {
    expect(
      discussionsOnPage('<ul><li class="js-navigation-item"><h3>No link</h3></li></ul>')
    ).toEqual([])
  })
})

describe("what came back out of the store", () => {
  test("takes what this version of the code writes", () => {
    expect(isKeptDiscussions(rows)).toBe(true)
    expect(isKeptDiscussions([])).toBe(true)
  })

  test("refuses an entry written before the shape had the field the grouping reads", () => {
    const before = [{ ...rows[0], answerable: undefined }]

    expect(isKeptDiscussions(before)).toBe(false)
    expect(isKeptDiscussions(null)).toBe(false)
    expect(isKeptDiscussions({ rows })).toBe(false)
  })
})

describe("what a maintainer put on a row", () => {
  /*
   * One of the twenty-five, which is what a label list looks like on a real repository. Read off
   * their `data-name` rather than the anchor's text, which carries a colour swatch and their own
   * whitespace around it.
   */
  test("reads a label by their own name for it", () => {
    const labelled = rows.filter((one) => one.labels.length > 0)

    expect(labelled).toHaveLength(1)
    expect(labelled[0]?.labels).toEqual(["Linking and Navigating"])
  })

  test("a row with none has none rather than a blank one", () => {
    expect(rows[0]?.labels).toEqual([])
  })
})

/*
 * `/orgs/community/discussions` as GitHub served it on 2026-09-04, which is where GitHub runs its
 * own product feedback and is the busiest Discussions surface there is. Read by the same parser,
 * unchanged: the two pages differ in the path in front of the word `discussions` and in the
 * layout around the rows, and in nothing this file reads.
 */
const theirs = await Bun.file("tests/fixtures/orgDiscussionsList.html").text()

describe("an organisation's discussions", () => {
  const orgRows = discussionsOnPage(theirs)

  test("reads every row, and knows it is an organisation's", () => {
    expect(orgRows).toHaveLength(25)
    expect(orgRows[0]?.reference.home).toEqual({ kind: "organisation", org: "community" })
    expect(orgRows[0]?.url).toBe("/orgs/community/discussions/206513")
  })

  test("reads the same facts off it as off a repository's", () => {
    const first = orgRows[0]

    expect(first?.title).toBe('Account stuck in "Awaiting Benefits" since Aug 14')
    expect(first?.author).toBe("Juanndz")
    expect(first?.comments).toBe(2)
    expect(first?.category.name).toBe("GitHub Education")
    expect(first?.labels).toContain("Bug")
  })

  /* Twenty-three of them, which is what a forum this size looks like. */
  test("names every category their sidebar carries", () => {
    expect(categoriesOnPage(theirs)).toHaveLength(23)
  })

  test("says there is another page, off their own next link", () => {
    expect(hasMoreAfter(theirs)).toBe(true)
  })

  /*
   * The point of one code path. Their own forum is where the stale ones pile up worst, and the
   * same rule files them.
   */
  test("files them by who owes the next move, as it files a repository's", () => {
    const courts = orgRows.map(courtOf)

    expect(courts.filter((one) => one === "needs-you").length).toBeGreaterThan(0)
    expect(courts.filter((one) => one === "running")).toHaveLength(0)
  })
})
