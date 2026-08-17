import { describe, expect, it } from "bun:test"
import { bundledLanguages } from "./shiki"

/**
 * The two lines Pierre's `resolveLanguage` runs against this map, copied rather
 * than imported: importing it pulls in a worker check and a module-level cache,
 * and what is under test here is the map's answer to a name.
 */
const asPierreAsks = async (lang: string) => {
  if (!Object.prototype.hasOwnProperty.call(bundledLanguages, lang))
    throw new Error(`resolveLanguage: "${lang}" not found in bundled or custom languages`)

  const load = bundledLanguages[lang]
  if (load === undefined)
    throw new Error(`resolveLanguage: "${lang}" not found in bundled or custom languages`)

  const { default: data } = await load()
  return data
}

describe("the languages a diff can be drawn in", () => {
  it("draws one it has the grammar for", async () => {
    const [grammar] = await asPierreAsks("typescript")

    expect(grammar?.name).toBe("typescript")
    expect(grammar?.patterns.length).toBeGreaterThan(0)
  })

  /*
   * A pull request holding a Zig file threw `resolveLanguage: "zig" not found`
   * out of the renderer, which is an unhandled rejection and a card that draws
   * nothing — for a file every reader can read perfectly well unhighlighted.
   */
  it("draws one it has no grammar for, without colour", async () => {
    const [grammar] = await asPierreAsks("zig")

    expect(grammar?.name).toBe("zig")
    expect(grammar?.patterns).toEqual([])
  })

  // A map that answers `then` is a promise as far as JavaScript is concerned, and
  // the first thing to await it waits for a language.
  it("is not a promise", () => {
    expect((bundledLanguages as Record<string, unknown>)["then"]).toBeUndefined()
  })

  it("answers for any name, because the name comes off a file GitHub served", async () => {
    for (const lang of ["nim", "elixir", "cobol"]) {
      const [grammar] = await asPierreAsks(lang)
      expect(grammar?.name).toBe(lang)
    }
  })
})
