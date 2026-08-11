import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { repositoryNumberFor, repositoryNumberOn } from "./uploading"

const pageWith = (metas: Record<string, string>): Pick<Document, "querySelector"> => ({
  querySelector: (asked: string) => {
    const name = /meta\[name="(.+)"\]/.exec(asked)?.[1]
    const content = name === undefined ? undefined : metas[name]
    return content === undefined
      ? null
      : ({ getAttribute: () => content } as unknown as Element)
  }
})

const HERE = { owner: "flazouh", repo: "stack-probe" }

describe("the number their upload route wants", () => {
  test("reads the meta an issue page carries", () => {
    const page = pageWith({ "octolytics-dimension-repository_id": "1316442384" })

    expect(repositoryNumberOn(page)).toEqual(Option.some("1316442384"))
  })

  test("reads the hovercard tag, which is all the page for a new issue carries", () => {
    const page = pageWith({ "hovercard-subject-tag": "repository:1316442384" })

    expect(repositoryNumberOn(page)).toEqual(Option.some("1316442384"))
  })

  test("takes no notice of a hovercard tag about something other than a repository", () => {
    const page = pageWith({ "hovercard-subject-tag": "issue:9912" })

    expect(repositoryNumberOn(page)).toEqual(Option.none())
  })

  test("takes no notice of a meta that is not a number, whatever else it may be", () => {
    const page = pageWith({ "octolytics-dimension-repository_id": "R_kgDOTndREA" })

    expect(repositoryNumberOn(page)).toEqual(Option.none())
  })

  test("says nothing where the page carries neither", () => {
    expect(repositoryNumberOn(pageWith({}))).toEqual(Option.none())
  })
})

describe("refusing to aim at a repository the page does not say it is", () => {
  const page = pageWith({ "octolytics-dimension-repository_id": "1316442384" })

  test("hands the number over where the document agrees whose it is", () => {
    expect(repositoryNumberFor(page, HERE, () => true)).toEqual(Option.some("1316442384"))
  })

  // Their app navigates without loading, so the meta can be the one served for the
  // repository the reader was looking at a moment ago.
  test("hands nothing over where the document is about somewhere else", () => {
    expect(repositoryNumberFor(page, HERE, () => false)).toEqual(Option.none())
  })
})
