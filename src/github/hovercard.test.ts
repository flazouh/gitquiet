import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { aboutRepository, hovercardRoute, portraitIn } from "./hovercard"

/**
 * Read against three cards taken off github.com rather than written here, because
 * what is being tested is whether their markup is understood — and markup written
 * to be understood by the parser that reads it proves nothing at all.
 *
 * The three between them cover what varies: a name and a location and no bio, a
 * bio and organisations and a Sponsor button, and a card asked in the light of a
 * repository, where the organisations line becomes an activity line instead.
 */

const fixture = (name: string): Promise<string> =>
  Bun.file(`${import.meta.dir}/../../tests/fixtures/${name}.html`).text()

const torvalds = await fixture("hovercardTorvalds")
const sindresorhus = await fixture("hovercardSindresorhus")
const gaearonInRepo = await fixture("hovercardGaearon")

const read = (html: string, login: string) => {
  const found = portraitIn(html, login)
  if (Option.isNone(found)) throw new Error(`no portrait in the card for ${login}`)
  return found.value
}

describe("the person in one of GitHub's hovercards", () => {
  test("reads the name they go by, which is not their login", () => {
    expect(read(torvalds, "torvalds").name).toEqual(Option.some("Linus Torvalds"))
  })

  test("reads where they are", () => {
    expect(read(torvalds, "torvalds").location).toEqual(Option.some("Portland, OR"))
  })

  test("reads the bio, where there is one", () => {
    expect(read(sindresorhus, "sindresorhus").bio).toEqual(
      Option.some(
        "Full-Time Open-Sourcerer. Focused on Swift & JavaScript. Makes macOS apps, CLI tools, npm packages."
      )
    )
  })

  test("leaves the bio out rather than empty where there is none", () => {
    expect(read(torvalds, "torvalds").bio).toEqual(Option.none())
  })

  test("reads their pronouns, which sit behind a separator rather than in a field", () => {
    expect(read(gaearonInRepo, "gaearon").pronouns).toEqual(Option.some("he/him"))
  })

  test("reads GitHub's own line about them", () => {
    // Asked in the light of a repository, which is what a repository's list asks.
    expect(read(gaearonInRepo, "gaearon").note).toEqual(
      Option.some("Committed to this repository in the past week")
    )
  })

  test("takes the same line as the organisations when nothing was asked about", () => {
    const note = read(sindresorhus, "sindresorhus").note
    expect(Option.getOrThrow(note)).toContain("Member of")
    expect(Option.getOrThrow(note)).toContain("H5BP")
  })

  test("notices a Sponsor button, which is the only way to know they take sponsors", () => {
    expect(read(sindresorhus, "sindresorhus").sponsorable).toBe(true)
    expect(read(torvalds, "torvalds").sponsorable).toBe(false)
  })

  test("takes the face at the size a card wants rather than deriving one", () => {
    expect(Option.getOrThrow(read(torvalds, "torvalds").faceUrl)).toContain("avatars.githubusercontent.com")
  })

  test("says whether the reader already follows them, off the button on offer", () => {
    // Both forms are always there and the one that does not apply is hidden. In all
    // three of these the reader follows nobody, so Follow is the visible one.
    expect(read(torvalds, "torvalds").followedByViewer).toBe(false)
  })

  test("answers with nothing for a login GitHub has no card for", () => {
    // An app has no profile page, so `dependabot[bot]` answers 404 and there is
    // nothing to draw. Nothing rather than a blank card with a login in it.
    expect(portraitIn("<html><body>Not Found</body></html>", "dependabot[bot]")).toEqual(
      Option.none()
    )
  })
})

describe("where the card is asked for", () => {
  test("asks by login", () => {
    expect(hovercardRoute("gaearon", Option.none())).toBe("/users/gaearon/hovercard")
  })

  test("asks in the light of a repository, so the line becomes activity in it", () => {
    expect(hovercardRoute("gaearon", Option.some(aboutRepository("10270250")))).toBe(
      "/users/gaearon/hovercard?subject=repository%3A10270250"
    )
  })

  test("escapes a login rather than trusting it into a path", () => {
    expect(hovercardRoute("a/b", Option.none())).toBe("/users/a%2Fb/hovercard")
  })
})
