import { describe, expect, test } from "bun:test"
import { Option } from "effect"

import {
  addressOf,
  discussionIn,
  discussionListIn,
  listAddressOf,
  listRouteOf,
  type Home
} from "./discussionRoutes"

const at = (path: string): string => `https://github.com${path}`

const nextjs: Home = { kind: "repository", owner: "vercel", repo: "next.js" }
const community: Home = { kind: "organisation", org: "community" }


describe("reading a discussion list out of an address", () => {
  test("reads a repository's whole list", () => {
    const found = discussionListIn(at("/vercel/next.js/discussions"))

    expect(Option.isSome(found)).toBe(true)
    expect(Option.getOrThrow(found).home).toEqual(nextjs)
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
   * `/orgs/community/discussions` is where GitHub runs its own product feedback, and it is the
   * busiest Discussions surface there is. An organisation is a home like a repository, and never
   * an owner called "orgs".
   */
  test("reads an organisation's discussions as an organisation's", () => {
    expect(Option.getOrThrow(discussionListIn(at("/orgs/community/discussions"))).home).toEqual(
      community
    )
    expect(
      Option.getOrThrow(discussionListIn(at("/orgs/community/discussions/categories/discussions")))
        .category
    ).toEqual(Option.some("discussions"))
    expect(discussionIn(at("/orgs/community/discussions/88425"))).toEqual(
      Option.some({ home: community, number: 88425 })
    )
  })

  test("refuses GitHub's own pages, which are not owners", () => {
    for (const path of [
      "/settings/discussions",
      "/notifications/discussions",
      "/orgs/discussions"
    ]) {
      expect(discussionListIn(at(path))).toEqual(Option.none())
    }
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
      Option.some({ home: nextjs, number: 70178 })
    )
  })

  test("keeps whatever the address carried beside it", () => {
    expect(
      discussionIn(at("/vercel/next.js/discussions/70178?sort=top#discussioncomment-11004713"))
    ).toEqual(Option.some({ home: nextjs, number: 70178 }))
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

  test("refuses the list above it", () => {
    expect(discussionIn(at("/vercel/next.js/discussions"))).toEqual(Option.none())
  })
})

describe("writing the addresses back", () => {
  test("a discussion's own address is the one it was read from", () => {
    const path = "/vercel/next.js/discussions/70178"

    expect(addressOf(Option.getOrThrow(discussionIn(at(path))))).toBe(path)
  })

  test("a list's address is theirs, all of it or one category", () => {
    expect(listAddressOf(nextjs)).toBe("/vercel/next.js/discussions")
    expect(listAddressOf(nextjs, Option.some("show-and-tell"))).toBe(
      "/vercel/next.js/discussions/categories/show-and-tell"
    )
    expect(listAddressOf(community)).toBe("/orgs/community/discussions")
  })

  test("a category that needs escaping comes back escaped, and reads back the same", () => {
    const written = listAddressOf(
      { kind: "repository", owner: "acme", repo: "tools" },
      Option.some("q&a")
    )

    expect(written).toBe("/acme/tools/discussions/categories/q%26a")
    expect(Option.getOrThrow(discussionListIn(at(written))).category).toEqual(Option.some("q&a"))
  })
})

describe("writing a whole page's address and reading it back", () => {
  const list = (over: Partial<Parameters<typeof listRouteOf>[0]> = {}) => ({
    home: nextjs,
    category: Option.none<string>(),
    query: "",
    page: 1,
    ...over
  })

  test("the plain list is the plain address", () => {
    expect(listRouteOf(list())).toBe("/vercel/next.js/discussions")
  })

  test("a category, a search and a page are all in it", () => {
    expect(
      listRouteOf(list({ category: Option.some("help"), query: "is:unanswered", page: 3 }))
    ).toBe("/vercel/next.js/discussions/categories/help?discussions_q=is%3Aunanswered&page=3")
  })

  /*
   * Three things read this string: the gateway asks GitHub at it, the store keeps the answer
   * under it, and the screen tells one visit from another by it. A hand-made join stood in for
   * the third once, and its separator could appear inside a search.
   */
  test("every shape of list reads back as the list it was written from", () => {
    const every = [
      list(),
      list({ category: Option.some("show-and-tell") }),
      list({ query: "sort:top" }),
      list({ page: 4 }),
      list({ category: Option.some("q&a"), query: "is:open label:\"good first\"", page: 2 })
    ]

    for (const one of every) {
      expect(discussionListIn(at(listRouteOf(one)))).toEqual(Option.some(one))
    }
  })

  test("two lists that differ only in where the words fall get different addresses", () => {
    const asCategory = listRouteOf(list({ category: Option.some("help"), query: "open" }))
    const asQuery = listRouteOf(list({ query: "help open" }))

    expect(asCategory).not.toBe(asQuery)
  })
})
