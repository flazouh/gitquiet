import { describe, expect, it, test } from "bun:test"
import { drawnBy, held, named, nameIn, sameName, SURFACES, shadowFor } from "./engine"

/**
 * The one line in the engine that behaves differently on the two platforms.
 *
 * A content script has no custom element registry, so `<diffs-container>` never
 * upgrades and never attaches its own shadow root. A window has a real one, so the
 * element upgrades the moment it is created and has attached one already — and
 * `attachShadow` on a host that has one throws `NotSupportedError`, which threw out
 * of a mount effect and unmounted the whole card. The pull request had been read
 * correctly; the window went blank.
 */
describe("the shadow root a diff is drawn into", () => {
  it("attaches one where nothing has", () => {
    const host = document.createElement("div")

    const shadow = shadowFor(host)
    expect(host.shadowRoot).toBe(shadow)
  })

  it("uses the one an upgraded element attached for itself", () => {
    const host = document.createElement("div")
    const already = host.attachShadow({ mode: "open" })

    expect(shadowFor(host)).toBe(already)
  })

  it("does not ask twice for the same host", () => {
    const host = document.createElement("div")

    const first = shadowFor(host)
    expect(() => shadowFor(host)).not.toThrow()
    expect(shadowFor(host)).toBe(first)
  })
})

describe("the surfaces a diff sits on", () => {
  it("hovers with the pack's hover, not GitHub's muted fill", () => {
    expect(SURFACES["--diffs-bg-hover-override"]).toBe("var(--color-hover)")
  })

  it("uses the pack's mono, then GitHub's, then a system stack", () => {
    expect(SURFACES["--diffs-font-family"]).toContain("--font-mono")
    expect(SURFACES["--diffs-font-family"]).toContain("--fontStack-monospace")
  })
})

describe("the identifier under the pointer", () => {
  const token = {
    lineNumber: 42,
    lineCharStart: 8,
    lineCharEnd: 16,
    tokenText: "renderDiff",
    side: "additions" as const
  }

  it("is carried over with the renderer's columns under this file's words", () => {
    expect(named(token)).toEqual({
      line: 42,
      from: 8,
      to: 16,
      text: "renderDiff",
      side: "additions"
    })
  })

  it("has no side in a file that is not a diff, rather than a guessed one", () => {
    const { side: _side, ...file } = token

    expect("side" in named(file)).toBe(false)
  })
})

describe("what the reader was holding", () => {
  const nothing = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

  it("reads Command and Control as the same intent, which is the platform's rule", () => {
    expect(held({ ...nothing, metaKey: true }).go).toBe(true)
    expect(held({ ...nothing, ctrlKey: true }).go).toBe(true)
    expect(held(nothing).go).toBe(false)
  })

  it("carries Shift and Alt without deciding anything about them", () => {
    expect(held({ ...nothing, shiftKey: true, altKey: true })).toEqual({
      go: false,
      shift: true,
      alt: true
    })
  })
})

describe("whether a Name is the one the pointer is on", () => {
  const name = { line: 7, from: 2, to: 5, text: "one", side: "additions" as const }

  it("is the same Name rebuilt, because a pane may hand back a new object", () => {
    expect(sameName(name, { ...name })).toBe(true)
  })

  it("is not the same line, the same column, or the same side", () => {
    expect(sameName(name, { ...name, line: 8 })).toBe(false)
    expect(sameName(name, { ...name, from: 3 })).toBe(false)
    expect(sameName(name, { ...name, side: "deletions" })).toBe(false)
  })

  it("does not read the text, which is the same word in a hundred places", () => {
    expect(sameName(name, { ...name, text: "other" })).toBe(true)
  })
})

describe("which half of the file a line belongs to", () => {
  const lineOf = (kind: string | null): HTMLElement => {
    const row = document.createElement("div")
    if (kind !== null) row.setAttribute("data-line-type", kind)
    const token = document.createElement("span")
    row.append(token)
    return token
  }

  const token = (kind: string | null, side: "additions" | "deletions") => ({
    lineNumber: 4,
    lineCharStart: 2,
    lineCharEnd: 8,
    tokenText: "shape",
    side,
    tokenElement: lineOf(kind)
  })

  test("reads a context line as the file as it is, whichever column drew it", () => {
    // The event answers with a column, and a context line is drawn in both. Read
    // as a deletion it stops every unchanged line in a diff from answering —
    // which is most of the lines in most diffs.
    expect(named(token("context", "deletions")).side).toBe("additions")
    expect(named(token("context", "additions")).side).toBe("additions")
  })

  test("reads an added line as the file as it is", () => {
    expect(named(token("change-addition", "additions")).side).toBe("additions")
  })

  test("reads a deleted line as the file as it was, which is another file", () => {
    expect(named(token("change-deletion", "deletions")).side).toBe("deletions")
  })

  test("takes the event's own word where the line does not say", () => {
    expect(named(token(null, "deletions")).side).toBe("deletions")
  })
})

/**
 * Which half of the file a token belongs to.
 *
 * A pull request draws far more deletions than a commit usually does, and a
 * name on a deleted line is a name in a file that no longer exists at this
 * commit — asking about it looks up the new half for an old line number and
 * answers about whatever happens to be there now.
 */
describe("the half of a file a name is in", () => {
  const rowOf = (kind: string | null): HTMLElement => {
    const row = document.createElement("div")
    if (kind !== null) row.setAttribute("data-line-type", kind)
    const token = document.createElement("span")
    row.append(token)
    return token
  }

  const name = (kind: string | null, side?: "additions" | "deletions") =>
    named({
      lineNumber: 12,
      lineCharStart: 0,
      lineCharEnd: 4,
      tokenText: "each",
      ...(side === undefined ? {} : { side }),
      tokenElement: rowOf(kind)
    })

  test("reads a deleted line as the old half, whatever column drew it", () => {
    expect(name("change-deletion", "additions").side).toBe("deletions")
  })

  test("reads a context line as the new half, which is the file as it is now", () => {
    // Drawn in both columns, so it arrives as whichever the renderer was
    // laying out — and most lines in most diffs are these.
    expect(name("context", "deletions").side).toBe("additions")
    expect(name("context-expanded", "deletions").side).toBe("additions")
  })

  test("answers for a token that arrived with no column at all", () => {
    // This used to come out with no side, which reads downstream as "not a
    // deletion" and asks the new half about an old line.
    expect(name("change-deletion").side).toBe("deletions")
  })

  test("passes the column through where the row says nothing", () => {
    expect(name(null, "deletions").side).toBe("deletions")
  })

  test("still has no side at all in a file that is not a diff", () => {
    // A whole file has no halves. A side invented here would read downstream as
    // a fact about a diff that does not exist.
    expect("side" in name(null)).toBe(false)
  })
})

/**
 * Whose token a token is.
 *
 * The uses panel draws a preview of the code inside a row of the file the
 * reader is on, and a drawing inside a drawing is two renderers over one press:
 * their interaction manager reads the event's composed path, which runs through
 * the preview's shadow root and out into the file's, so the file was told about
 * a name it never drew. It followed it — throwing the panel away and opening a
 * new one on the name the panel was already open on, a trail that went round in
 * a ring.
 */
describe("which drawing a token was drawn by", () => {
  /** A host with a drawing in it, and the token it drew. */
  const drawing = (): { readonly host: HTMLElement; readonly token: HTMLElement } => {
    const host = document.createElement("diffs-container")
    const token = document.createElement("span")
    shadowFor(host).append(token)
    return { host, token }
  }

  it("takes a token from its own shadow root", () => {
    const file = drawing()

    expect(drawnBy(file.host, { tokenElement: file.token })).toBe(true)
  })

  it("refuses one from a drawing hung inside a row of it", () => {
    const file = drawing()
    const preview = drawing()
    // Where the panel puts it: a row of the file, which is the host's own
    // children rather than the shadow root the renderer slots them into.
    file.host.append(preview.host)

    expect(drawnBy(file.host, { tokenElement: preview.token })).toBe(false)
    expect(drawnBy(preview.host, { tokenElement: preview.token })).toBe(true)
  })

  it("refuses one from a drawing that is nowhere near it", () => {
    const file = drawing()
    const other = drawing()

    expect(drawnBy(file.host, { tokenElement: other.token })).toBe(false)
  })

  it("takes one that arrives without an element at all", () => {
    // An element is the only thing that can say a token belongs to somebody
    // else, so a token with none is this drawing's — refusing it would stop
    // following a name the day their event stops carrying one.
    const file = drawing()

    expect(drawnBy(file.host, {})).toBe(true)
  })
})

/**
 * The name under the pointer, out of a token that holds more than one.
 *
 * A token is drawn by colour, not by name: `Effect.succeed` is one token for
 * `" Effect."` and another for `"succeed"`, and an argument list is a single
 * token from the bracket to the bracket. Measured over this repository, 48.7%
 * of the names a reader can see are inside a token that is not just that name,
 * and every one of them resolved at the token's start — a space, a bracket —
 * which answers nothing. Half the file could not be followed.
 *
 * The element is stood in for with a rectangle and a length, which is all the
 * measuring needs: code is drawn monospaced, so a character is the width over
 * the count.
 */
describe("the name under the pointer", () => {
  /** A token, with an element whose box makes each character ten wide. */
  const token = (text: string, at: number, left = 0) => ({
    lineCharStart: at,
    lineCharEnd: at + text.length,
    tokenText: text,
    tokenElement: {
      getBoundingClientRect: () => ({ left, width: text.length * 10 }),
      // `sideOf` asks the element which half of a diff it is in. A file being
      // read has one side and answers nothing, which is this.
      closest: () => null
    } as unknown as HTMLElement
  })

  /** The middle of the `nth` character of a token drawn from `left`. */
  const over = (nth: number, left = 0) => left + nth * 10 + 5

  test("is the whole token where the token is exactly one name", () => {
    expect(nameIn(token("succeed", 12), over(3))).toEqual({
      text: "succeed",
      from: 12,
      to: 19
    })
  })

  test("is the object of a member expression, which is drawn with its own dot", () => {
    // `  Effect.succeed(...)` — Shiki draws "  Effect." as one token.
    const found = nameIn(token("  Effect.", 0), over(4))
    expect(found.text).toBe("Effect")
    expect(found).toEqual({ text: "Effect", from: 2, to: 8 })
  })

  test("is one argument out of a whole argument list", () => {
    // `f(store, document, me)` — everything from the bracket is one token.
    const list = token("(store, document, me)", 1)
    expect(nameIn(list, over(1 + 1)).text).toBe("store")
    expect(nameIn(list, over(1 + 8)).text).toBe("document")
    expect(nameIn(list, over(1 + 18)).text).toBe("me")
  })

  test("counts columns from where the token starts, not from the line", () => {
    // `document` sits eight characters into a token that starts at column 1.
    expect(nameIn(token("(store, document, me)", 1), over(1 + 8))).toEqual({
      text: "document",
      from: 9,
      to: 17
    })
  })

  test("is one name out of an import clause, which is drawn whole", () => {
    const clause = token(" { Effect, Option } ", 6)
    expect(nameIn(clause, over(3)).text).toBe("Effect")
    expect(nameIn(clause, over(12)).text).toBe("Option")
  })

  test("is the token itself where the pointer is on nothing wordy", () => {
    // The dot after the name is not a name, and inventing one from the
    // character beside it would follow something the reader did not point at.
    expect(nameIn(token("  Effect.", 0), over(8))).toEqual({
      text: "  Effect.",
      from: 0,
      to: 9
    })
  })

  test("is the token itself where there is no pointer to ask about", () => {
    // A press that arrives without coordinates, which is what the leave
    // handler has — and the answer it had before any of this.
    expect(nameIn(token("  Effect.", 0))).toEqual({ text: "  Effect.", from: 0, to: 9 })
  })

  test("is the token itself where the pointer is outside it", () => {
    expect(nameIn(token("  Effect.", 0), -50).text).toBe("  Effect.")
    expect(nameIn(token("  Effect.", 0), 9999).text).toBe("  Effect.")
  })

  test("reads the token's own place on the screen, not the line's", () => {
    // A token drawn 400px in: the arithmetic is against its own left edge.
    const found = nameIn(token("(store, document)", 1, 400), over(8, 400))
    expect(found.text).toBe("document")
  })

  test("is any of the three names in a token that holds a whole signature", () => {
    // `export default function pLimit(concurrency: number | Options): LimitFunction;`
    // is drawn as one token from the bracket to the semicolon. Not one of the
    // three names in it is a token of its own, and for a while this was written
    // off as needing the grammar changed. It does not: a token holding three
    // names is a token like any other once the pointer says which is meant.
    //
    //          1         2         3         4
    // 0123456789012345678901234567890123456789012345
    // concurrency: number | Options): LimitFunction;
    const lump = token("concurrency: number | Options): LimitFunction;", 30)
    expect(nameIn(lump, over(2)).text).toBe("concurrency")
    expect(nameIn(lump, over(15)).text).toBe("number")
    expect(nameIn(lump, over(25)).text).toBe("Options")
    expect(nameIn(lump, over(36)).text).toBe("LimitFunction")
  })

  test("counts a lumped signature's columns from the line, not from the token", () => {
    // `Options` is 22 characters into a token that starts at column 30.
    const lump = token("concurrency: number | Options): LimitFunction;", 30)
    expect(nameIn(lump, over(25))).toEqual({ text: "Options", from: 52, to: 59 })
  })

  test("hands a Name the narrowed columns, which is what a press is judged by", () => {
    // `isTheWriting` compares a Writing's column to `from + 1`, so a Name
    // reported at the token's start makes every press a navigation.
    const one = named({ ...token("  Effect.", 0), lineNumber: 4 }, over(4))
    expect(one).toEqual({ line: 4, from: 2, to: 8, text: "Effect" })
  })
})
