import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { matching, ranked, switchable, type Repository } from "./repositories"
import type { RepositoryAtWork } from "./rail"

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

const atWork = (owner: string, repo: string, needsYou = 1): RepositoryAtWork => ({
  owner,
  repo,
  name: repo,
  count: needsYou,
  needsYou
})

/**
 * Finding one repository among a hundred and fifty, which is the number a live account
 * turned out to have. Remembering which of them you want is the thing this replaces.
 */
describe("narrowing a list of repositories by typing", () => {
  test("matches part of a repository's name", () => {
    const found = matching([repository("flazouh/octo-repo"), repository("flazouh/lumen")], "cto")

    expect(found.map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })

  test("matches an owner, so typing an organisation narrows to its repositories", () => {
    const found = matching(
      [repository("flowline-labs/flowline"), repository("flazouh/octo-repo")],
      "flowline-labs"
    )

    expect(found.map((one) => one.nameWithOwner)).toEqual(["flowline-labs/flowline"])
  })

  test("does not care about case, because nobody types capitals into a filter", () => {
    expect(matching([repository("flazouh/Octo-repo")], "octo-repo")).toHaveLength(1)
  })

  test("takes words in any order, so half of each name is enough", () => {
    const found = matching([repository("flazouh/octo-repo"), repository("other/octo-repo")], "octo-repo fla")

    expect(found.map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })

  test("is the whole list when nothing has been typed", () => {
    const all = [repository("flazouh/octo-repo"), repository("flazouh/lumen")]

    expect(matching(all, "")).toEqual(all)
    expect(matching(all, "   ")).toEqual(all)
  })
})

describe("the order the whole list is offered in", () => {
  test("puts the repositories the reader's work is in first, in that order", () => {
    const found = ranked(
      [repository("flazouh/zebra"), repository("flazouh/octo-repo"), repository("flazouh/lumen")],
      [atWork("flazouh", "octo-repo", 2), atWork("flazouh", "lumen", 1)]
    )

    expect(found.map((one) => one.repo)).toEqual(["octo-repo", "lumen", "zebra"])
  })

  test("and everything else alphabetically, which at least stays put between reads", () => {
    // Never by when anything last changed: that is the rule that puts 2016 at the top of
    // GitHub's own list, and their filter route does not answer with dates anyway.
    const found = ranked(
      [repository("flazouh/beta"), repository("acme/alpha"), repository("flazouh/alpha")],
      []
    )

    expect(found.map((one) => one.nameWithOwner)).toEqual([
      "acme/alpha",
      "flazouh/alpha",
      "flazouh/beta"
    ])
  })

  test("keeps every repository, since this is the list that is meant to be complete", () => {
    const all = [repository("a/one"), repository("b/two"), repository("c/three")]

    expect(ranked(all, [atWork("b", "two")])).toHaveLength(3)
  })
})

/**
 * The switcher behind the name in the bar, which is a different list to the one above.
 *
 * A Destination is browsed and this is aimed at: it opens under the pointer, over the
 * repository being read, and closes on the next press. So the top of it has to hold the
 * few a reader moves between all day, and the whole point is that those few are the same
 * few tomorrow — an order that recomputes itself hourly is one nobody learns.
 */
describe("the order the switcher offers repositories in", () => {
  const all = [
    repository("Aditechweb3/web3"),
    repository("agentclientprotocol/acp"),
    repository("flazouh/octo-repo"),
    repository("flowline-labs/flowline"),
    repository("octo-org/octo-repo")
  ]

  test("the one being read comes first, whatever else is true of it", () => {
    // It opened on `Aditechweb3/web3` with the name in the button a hundred rows below,
    // so the first thing the menu said was that the reader was somewhere else.
    const found = switchable(all, { here: "flazouh/octo-repo" })

    expect(found[0]?.nameWithOwner).toBe("flazouh/octo-repo")
  })

  test("then the ones the reader pinned, in the order they pinned them", () => {
    const found = switchable(all, {
      here: "flazouh/octo-repo",
      pinned: ["flowline-labs/flowline", "Aditechweb3/web3"]
    })

    expect(found.slice(0, 3).map((one) => one.nameWithOwner)).toEqual([
      "flazouh/octo-repo",
      "flowline-labs/flowline",
      "Aditechweb3/web3"
    ])
  })

  test("then the ones last read, most recent of them first", () => {
    const found = switchable(all, {
      here: "flazouh/octo-repo",
      lately: ["octo-org/octo-repo", "agentclientprotocol/acp"]
    })

    expect(found.slice(0, 3).map((one) => one.nameWithOwner)).toEqual([
      "flazouh/octo-repo",
      "octo-org/octo-repo",
      "agentclientprotocol/acp"
    ])
  })

  test("a pin beats a visit, one being asked for and the other only noticed", () => {
    const found = switchable(all, {
      pinned: ["Aditechweb3/web3"],
      lately: ["octo-org/octo-repo", "Aditechweb3/web3"]
    })

    expect(found.slice(0, 2).map((one) => one.nameWithOwner)).toEqual([
      "Aditechweb3/web3",
      "octo-org/octo-repo"
    ])
  })

  test("the rest keep the order they came in, a list that rearranges being unlearnable", () => {
    const found = switchable(all, { here: "flazouh/octo-repo", lately: ["flowline-labs/flowline"] })

    expect(found.slice(2).map((one) => one.nameWithOwner)).toEqual([
      "Aditechweb3/web3",
      "agentclientprotocol/acp",
      "octo-org/octo-repo"
    ])
  })

  test("keeps every repository and drops none, whichever band each fell in", () => {
    const found = switchable(all, {
      here: "flazouh/octo-repo",
      pinned: ["Aditechweb3/web3"],
      lately: ["octo-org/octo-repo", "flazouh/octo-repo"]
    })

    expect(found).toHaveLength(all.length)
    expect(new Set(found.map((one) => one.nameWithOwner)).size).toBe(all.length)
  })

  test("ignores a pin or a visit that names a repository nobody has any more", () => {
    const found = switchable([repository("flazouh/octo-repo")], {
      pinned: ["gone/away"],
      lately: ["also/gone"]
    })

    expect(found.map((one) => one.nameWithOwner)).toEqual(["flazouh/octo-repo"])
  })

  test("is GitHub's own order where the reader has pinned nothing and been nowhere", () => {
    expect(switchable(all, {}).map((one) => one.nameWithOwner)).toEqual(
      all.map((one) => one.nameWithOwner)
    )
  })
})
