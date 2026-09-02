import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { gistListIn, gistViewIn } from "./gist"

const parsedView = (url: string) => Option.getOrNull(gistViewIn(url))
const parsedList = (url: string) => Option.getOrNull(gistListIn(url))

const at = (path: string) => `https://gist.github.com${path}`

describe("the address of one gist", () => {
  test("reads the owner and the gist id out of it", () => {
    expect(parsedView(at("/octocat/6cad326836d38bd3a7ae"))).toEqual({
      owner: "octocat",
      id: "6cad326836d38bd3a7ae"
    })
  })

  test("does not mind a trailing slash", () => {
    expect(parsedView(at("/octocat/6cad326836d38bd3a7ae/"))?.id).toBe("6cad326836d38bd3a7ae")
  })

  test("refuses another host", () => {
    expect(parsedView("https://github.com/octocat/6cad326836d38bd3a7ae")).toBeNull()
  })

  test("refuses the search page, which is not a gist", () => {
    expect(parsedView(at("/search"))).toBeNull()
  })

  test("refuses a third segment, which is a gist's own sub-page", () => {
    expect(parsedView(at("/octocat/6cad326836d38bd3a7ae/forks"))).toBeNull()
    expect(parsedView(at("/octocat/6cad326836d38bd3a7ae/revisions"))).toBeNull()
  })

  test("refuses the front page, which names no gist", () => {
    expect(parsedView(at("/"))).toBeNull()
  })
})

describe("the address of a reader's own gist list", () => {
  test("reads the owner out of it", () => {
    expect(parsedList(at("/octocat"))).toEqual({ owner: "octocat", page: 1 })
  })

  test("reads a page number off the query", () => {
    expect(parsedList(at("/octocat?page=3"))).toEqual({ owner: "octocat", page: 3 })
  })

  test("refuses a single gist's own address", () => {
    expect(parsedList(at("/octocat/6cad326836d38bd3a7ae"))).toBeNull()
  })

  test("refuses the reserved pages that are not an owner", () => {
    expect(parsedList(at("/search"))).toBeNull()
    expect(parsedList(at("/discover"))).toBeNull()
    expect(parsedList(at("/mine"))).toBeNull()
  })

  test("refuses another host", () => {
    expect(parsedList("https://github.com/octocat")).toBeNull()
  })
})
