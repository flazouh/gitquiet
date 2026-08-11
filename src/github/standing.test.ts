import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import bare from "../../fixtures/github/repo-sidebar-bare.json"
import payload from "../../fixtures/github/repo-sidebar.json"
import { decodeSidebar, standingFrom } from "./standing"

const read = (given: unknown = payload) => standingFrom(Effect.runSync(decodeSidebar(given)))

describe("what a repository stands on", () => {
  test("takes the faces, the names behind them and how many there are in all", () => {
    const standing = read()

    expect(standing.hands.length).toBe(payload.contributors.contributors.length)
    expect(standing.hands[0]?.login).toBe("sebmarkbage")
    expect(standing.hands[0]?.called).toBe("Sebastian Markbåge")
    expect(standing.hands[0]?.face.startsWith("https://avatars.")).toBe(true)
    expect(standing.handCount).toEqual(Option.some(1760))
  })

  test("keeps GitHub's language colours, which readers know without reading the word", () => {
    const [first] = read().tongues

    expect(first?.name).toBe("JavaScript")
    expect(first?.share).toBe(49.5)
    expect(first?.colour).toBe("#f1e05a")
  })

  test("leaves the language bar in the order it came, widest first", () => {
    const shares = read().tongues.map((one) => one.share)

    expect(shares).toEqual([...shares].sort((left, right) => right - left))
  })

  test("points a language at that language inside this repository", () => {
    expect(read().tongues[0]?.url).toBe("/react/react/search?l=javascript")
  })

  test("reads the last thing shipped, and where the rest of them are", () => {
    const standing = read()

    expect(Option.getOrNull(standing.shipped)?.name).toBe("19.2.8 (July 21st, 2026)")
    expect(standing.shippedUrl).toEqual(Option.some("/react/react/releases"))
  })

  test("reads where builds went and how that went", () => {
    const landings = read().landings

    expect(landings.length).toBe(payload.deployments.environments.length)
    expect(landings.map((one) => one.state)).toContain("active")
  })

  test("reads how many others lean on this, with the faces GitHub sends", () => {
    const standing = read()

    expect(standing.leaning).toEqual(Option.some(30052750))
    expect(standing.leaningFaces.length).toBe(8)
  })

  describe("a repository that has none of it", () => {
    test("says nothing rather than drawing empty headings", () => {
      // Their own sidebar hides these too. A private repository with one author
      // would otherwise carry six headings saying it has nothing.
      const standing = read(bare)

      expect(standing.landings).toEqual([])
      expect(standing.leaning).toEqual(Option.none())
      expect(Option.isNone(standing.shipped)).toBe(true)
      expect(standing.parcels).toEqual(Option.none())
    })

    test("still has the one author who wrote it, and what they wrote it in", () => {
      const standing = read(bare)

      expect(standing.hands.map((one) => one.login)).toEqual(["flazouh"])
      expect(standing.handCount).toEqual(Option.some(1))
      expect(standing.tongues[0]?.name).toBe("TypeScript")
    })
  })

  test("decodes a payload with every section missing rather than failing on it", () => {
    // GitHub sends the keys with null behind them, and a deploy that stops
    // sending one at all should cost the section rather than the card.
    const standing = read({})

    expect(standing.hands).toEqual([])
    expect(standing.tongues).toEqual([])
  })
})
