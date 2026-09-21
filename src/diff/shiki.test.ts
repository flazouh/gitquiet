import { describe, expect, it } from "bun:test"
import { bundledLanguages, createHighlighterCore, createJavaScriptRegexEngine, type LanguageRegistration } from "./shiki"

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

/*
 * Opening cobra's `command.go` froze the page for over ninety seconds. One rule
 * of the Go grammar — a struct written on one line, `struct{ a, b int }` — starts
 * after any `{`, a `{` in a comment included, and splits the words that follow
 * into names and types every way it can before it gives up. JavaScriptCore took a
 * second over one comment line; V8, which is what a reader's browser runs, never
 * finished. The comment was going to win that line anyway.
 */
describe("the Go grammar, on a line it has no business with", () => {
  const STRUCT = [
    "type Command struct {",
    "\t// Use is the one-line usage message.",
    "\t//   { } marks a set of choices when one of the choices is required. If the choices are optional they go in brackets",
    "\tUse string",
    "}"
  ]

  const highlighter = async (grammar: ReadonlyArray<LanguageRegistration>) =>
    createHighlighterCore({ themes: [], langs: [[...grammar]], engine: createJavaScriptRegexEngine() })

  const scopes = async (grammar: ReadonlyArray<LanguageRegistration>, lines: ReadonlyArray<string>) => {
    const go = (await highlighter(grammar)).getLanguage("go")
    let state: Parameters<typeof go.tokenizeLine>[1] = null
    const out: Array<string> = []
    for (const line of lines) {
      const got = go.tokenizeLine(line, state, 0)
      state = got.ruleStack
      for (const token of got.tokens) out.push(`${line.slice(token.startIndex, token.endIndex ?? line.length)}=${token.scopes.at(-1)}`)
    }
    return out
  }

  it("reads a comment inside a struct in no time at all", async () => {
    const { default: grammar } = await bundledLanguages.go!()
    const go = (await highlighter(grammar)).getLanguage("go")
    // Its patterns compiled first, which is a cost every file pays once and not
    // the cost in question.
    let state: Parameters<typeof go.tokenizeLine>[1] = go.tokenizeLine(STRUCT[0]!, null, 0).ruleStack
    go.tokenizeLine(STRUCT[1]!, state, 0)

    /*
     * Five of those lines, for a budget no load can spend. JavaScriptCore gives
     * up on the shipped rule after about a second a line, where V8 does not give
     * up at all: five seconds before, and a few milliseconds now. A budget of one
     * is only reached by a test that is failing.
     */
    const comment = STRUCT[2]!
    const started = performance.now()
    for (let line = 0; line < 5; line++) state = go.tokenizeLine(comment, state, 0).ruleStack

    expect(performance.now() - started).toBeLessThan(1000)
  })

  it("still reads a struct written on one line as its fields and their types", async () => {
    const { default: patched } = await bundledLanguages.go!()
    const { default: theirs } = await import("@shikijs/langs/go")
    const lines = [
      "type Point struct{ X, Y int; Label string }",
      "type Wrap struct{ io.Reader }",
      "type Seen struct{ items map[string]interface{}; done chan struct{} }",
      "type Tight struct{ a int}",
      ...STRUCT.filter((line) => !line.includes("{ }"))
    ]

    expect(await scopes(patched, lines)).toEqual(await scopes(theirs, lines))
  })

  /*
   * The same shape of fault in twenty-three more rules: a channel type written
   * as a repeated group whose spaces can be split every way there is. Under V8,
   * sixteen `chan`s on a line took one of them eight seconds and eighteen did not
   * finish; atomic, they take three milliseconds.
   *
   * Asked of the patterns rather than timed, because this suite runs on
   * JavaScriptCore, which gives up on these early and so never shows the hang a
   * reader's Chrome would. What is checked is the cause: no channel group is left
   * that can be split again once it has matched.
   */
  it("leaves no channel group that can hand its spaces back", async () => {
    const { default: patched } = await bundledLanguages.go!()
    const { default: theirs } = await import("@shikijs/langs/go")
    /** Channel groups as shipped, in either spelling, still open to being split again. */
    const loose = (grammar: unknown): number => {
      const text = JSON.stringify(grammar)
      const count = (what: string) => text.split(what).length - 1
      return count("(?:\\\\s*[]*\\\\[]+{0,1}(?:<-") + count("(?:[]*\\\\[]+{0,1}(?:<-")
    }

    expect(loose(theirs)).toBeGreaterThan(20)
    expect(loose(patched)).toBe(0)
  })

  it("still reads channel types as it did", async () => {
    const { default: patched } = await bundledLanguages.go!()
    const { default: theirs } = await import("@shikijs/langs/go")
    const lines = [
      "var jobs chan chan<- int",
      "func pump(in <-chan chan string, out chan<- []byte) (<-chan error, error) {",
      "\treturn nil, nil",
      "}",
      "type Pipe struct {",
      "\tfeed   chan <-chan string",
      "\tdone   <-chan struct{}",
      "}"
    ]

    expect(await scopes(patched, lines)).toEqual(await scopes(theirs, lines))
  })

  it("closes a struct literal's fields at its own brace", async () => {
    // The one place the two differ, and the shipped rule is the one that is off:
    // it took `}{}` as a type and left the brace that ends the fields unmarked.
    const { default: patched } = await bundledLanguages.go!()
    const line = "var p = struct{ ch chan<- int; buf []byte }{}"

    const read = await scopes(patched, [line])
    expect(read.filter((one) => one.startsWith("}="))[0]).toBe("}=punctuation.definition.end.bracket.curly.go")
    expect(read).toContain("ch=variable.other.property.go")
    expect(read).toContain("byte=storage.type.byte.go")
  })
})
