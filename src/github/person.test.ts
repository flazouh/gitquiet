import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { personIn } from "./person"

const read = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/*
 * The same three pages `personRepos.test.ts` reads, because the column and the rows
 * arrive in one document and a parser tested against a page of its own would be tested
 * against a page nobody is served.
 *
 * `/flazouh?tab=repositories`: a name, a bio, a site and two socials, no company and no
 * location. `/sindresorhus?tab=repositories`: four socials. `/tj?tab=repositories`: a
 * company, and neither a site nor a social.
 */
const real = read(await Bun.file("tests/fixtures/personRepos.html").text())
const counted = read(await Bun.file("tests/fixtures/personReposCounted.html").text())
const archived = read(await Bun.file("tests/fixtures/personReposArchived.html").text())

const of = (page: Document) => Option.getOrThrow(personIn(page))
const got = <A>(one: Option.Option<A>): A | null => Option.getOrNull(one)

describe("who their page says they are", () => {
  test("reads the login, the name and the bio", () => {
    const who = of(real)

    expect(who.login).toBe("flazouh")
    expect(got(who.name)).toBe("Alex")
    expect(got(who.bio)).toContain("Building Acepe")
  })

  test("takes their face at the size a column draws it, not the sticky bar's thumbnail", () => {
    // Their 32-pixel copy comes first in the document, so the first match is the wrong one.
    expect(got(of(real).faceUrl)).toBe("https://avatars.githubusercontent.com/u/25705704?v=4")
  })

  test("reads both follow counts by the tab each goes to", () => {
    const who = of(real)

    expect(got(who.followers)).toBe("25")
    expect(got(who.following)).toBe("65")
  })

  test("keeps the label they wrote for a link, not its address", () => {
    const who = of(real)

    expect(got(who.site)).toEqual({ label: "acepe.dev", href: "https://acepe.dev" })
    expect(who.ways.map((way) => way.label)).toEqual(["@sasha_zelts", "u/SashaZelt"])
  })

  test("reads every way somebody offers, however many", () => {
    expect(of(counted).ways).toHaveLength(4)
  })

  test("reads the company where they gave one", () => {
    expect(got(of(archived).company)).toBe("Apex")
    expect(got(of(real).company)).toBeNull()
  })

  test("says nothing about a site nobody set", () => {
    expect(got(of(archived).site)).toBeNull()
  })

  test("carries the counts off their own tab row", () => {
    const who = of(real)

    expect(got(who.tally.repositories)).toBe("55")
    expect(got(who.tally.stars)).toBe("113")
  })

  /*
   * Their tab row is being rebuilt in Primer's React components, and the count moved with
   * it: `.Counter` on the old row, a `CounterLabel` inside a counter slot on the new one.
   * Measured on the live page, where the old hook read nothing and the tab row lost both
   * numbers. The hidden copy beside it is for a screen reader and would read "121 (121)".
   */
  test("carries those counts off their rebuilt tab row too", () => {
    const page = read(`
      <div class="h-card"><span class="vcard-username">flazouh</span></div>
      <nav>
        <a data-tab-item="repositories">
          <span data-component="text">Repositories</span>
          <span data-component="counter">
            <span aria-hidden="true" data-component="CounterLabel">121</span>
            <span class="prc-VisuallyHidden-VisuallyHidden-Q0qSB">&nbsp;(121)</span>
          </span>
        </a>
        <a data-tab-item="stars">
          <span data-component="text">Stars</span>
          <span data-component="counter">
            <span aria-hidden="true" data-component="CounterLabel">115</span>
          </span>
        </a>
      </nav>
    `)

    const who = of(page)
    expect(got(who.tally.repositories)).toBe("121")
    expect(got(who.tally.stars)).toBe("115")
  })

  test("notices the sponsor button where GitHub offered one", () => {
    expect(got(of(real).sponsorAt)).toBe("/sponsors/flazouh")
  })

  test("comes back with nothing on a page that has no such column", () => {
    // An organisation's page, which shares the address and carries none of this markup.
    expect(personIn(read("<main><div class='Layout'></div></main>"))).toEqual(Option.none())
  })

  test("comes back with nothing where the card has no login in it", () => {
    expect(personIn(read("<div class='h-card'><span class='vcard-fullname'>Alex</span></div>"))).toEqual(
      Option.none()
    )
  })

  test("reads a location where their page carries one", () => {
    const page = read(`
      <div class="h-card">
        <span class="vcard-username">jane</span>
        <ul class="vcard-details">
          <li itemprop="homeLocation"><span class="p-label">Lyon, France</span></li>
        </ul>
      </div>
    `)

    expect(got(of(page).location)).toBe("Lyon, France")
  })
})
