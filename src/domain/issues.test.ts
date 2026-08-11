import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
  INVOLVEMENTS,
  type Involvement,
  courtOfIssue,
  fromPathname,
  issueSaid,
  pageOf
} from "./issues"

const weighing = (involvement: Involvement, state: "open" | "closed" = "open") => ({
  involvement,
  state
})

describe("which Court an Involved Issue sits in", () => {
  test("one assigned to the reader is their move", () => {
    // The plainest form the question takes anywhere here: somebody has given
    // this to them, so the next move is theirs and nobody else's.
    expect(courtOfIssue(weighing("assigned"))).toBe("your-move")
  })

  test("one the reader raised is waiting on whoever answers it", () => {
    // Raising an issue is the act. Whether somebody else is already assigned to
    // it or nobody has picked it up yet, the response is not the reader's to
    // make, and a Your Move list of things nobody can do is a list nobody reads.
    expect(courtOfIssue(weighing("authored"))).toBe("waiting")
  })

  test("being mentioned in one is not being asked to move", () => {
    expect(courtOfIssue(weighing("mentioned"))).toBe("waiting")
  })

  test("a closed issue is Settled however the reader is involved in it", () => {
    // The read is a snapshot of a moment and the state outlives it, exactly as
    // a shelf does: an issue closed since is owed to nobody, and one still
    // asking for the reader's move is a row they open for nothing.
    for (const involvement of INVOLVEMENTS) {
      expect(courtOfIssue(weighing(involvement, "closed"))).toBe("settled")
    }
  })

  test("every involvement has a Court, so none of them can be drawn nowhere", () => {
    for (const involvement of INVOLVEMENTS) {
      expect(["your-move", "waiting", "settled"]).toContain(
        courtOfIssue(weighing(involvement))
      )
    }
  })

  test("a press on one goes to the issue rather than to a pull request of the same number", () => {
    // The two live at different addresses under the same repository and the
    // same number, so this is the one place a shared reference type would have
    // quietly linked to a page belonging to something else.
    expect(pageOf({ owner: "flazouh", repo: "acepe", number: 146 })).toBe(
      "/flazouh/acepe/issues/146"
    )
  })
})

describe("reading an issue out of an address", () => {
  test("names the repository and the number", () => {
    expect(fromPathname("/flazouh/acepe/issues/146")).toEqual(
      Option.some({ owner: "flazouh", repo: "acepe", number: 146 })
    )
  })

  test("reads one with a trailing slash, which is the same page", () => {
    expect(fromPathname("/flazouh/acepe/issues/146/")).toEqual(
      Option.some({ owner: "flazouh", repo: "acepe", number: 146 })
    )
  })

  test("refuses the repository's list, which is a different page", () => {
    // One segment shorter and a screen of its own. A parser that answered here
    // would put an issue's interface over a list of two hundred of them.
    expect(fromPathname("/flazouh/acepe/issues")).toEqual(Option.none())
  })

  test("refuses the form for raising one", () => {
    // `/issues/new` has the shape of an issue address and is not one, which is
    // what keeps this a number rather than a segment.
    expect(fromPathname("/flazouh/acepe/issues/new")).toEqual(Option.none())
  })

  test("refuses a pull request of the same number", () => {
    expect(fromPathname("/flazouh/acepe/pull/146")).toEqual(Option.none())
  })

  test("refuses anything deeper, which GitHub does not serve as an issue", () => {
    expect(fromPathname("/flazouh/acepe/issues/146/comments")).toEqual(Option.none())
  })

  test("round-trips the address it is read from", () => {
    // The parser and `pageOf` are inverses, and a press that goes somewhere the
    // parser then refuses is a screen that never draws.
    const reference = { owner: "flazouh", repo: "acepe", number: 146 }
    expect(fromPathname(pageOf(reference))).toEqual(Option.some(reference))
  })
})

/**
 * Which issue somebody means when they name one, in the shapes people write.
 *
 * For the duplicate close, which is the one verb on an issue that takes a second issue. Their
 * own picker is a search field, and GitHub's own accessibility thread on it says the sub-menu
 * it opens is confusing even to the team who shipped it. A field that takes whatever is on the
 * clipboard is the shorter road: a reader closing a duplicate has the other issue open in a
 * tab, and what they have is its address.
 */
describe("naming an issue, in the shapes a person writes one", () => {
  const here = { owner: "flazouh", repo: "stack-probe" }

  test("takes a number with a hash, which is how it is written in a sentence", () => {
    expect(issueSaid("#78", here)).toEqual(Option.some({ ...here, number: 78 }))
  })

  test("takes a bare number, because the hash is the part people forget", () => {
    expect(issueSaid("78", here)).toEqual(Option.some({ ...here, number: 78 }))
  })

  test("takes another repository's issue, which is where a duplicate often is", () => {
    expect(issueSaid("oven-sh/bun#1234", here)).toEqual(
      Option.some({ owner: "oven-sh", repo: "bun", number: 1234 })
    )
  })

  test("takes the whole address, which is what the clipboard holds", () => {
    expect(issueSaid("https://github.com/oven-sh/bun/issues/1234", here)).toEqual(
      Option.some({ owner: "oven-sh", repo: "bun", number: 1234 })
    )
  })

  test("takes an address with their anchor on the end, as a copied link carries", () => {
    expect(issueSaid("https://github.com/oven-sh/bun/issues/1234#issuecomment-99", here)).toEqual(
      Option.some({ owner: "oven-sh", repo: "bun", number: 1234 })
    )
  })

  test("ignores the spaces around it", () => {
    expect(issueSaid("  #78  ", here)).toEqual(Option.some({ ...here, number: 78 }))
  })

  /*
   * Nothing rather than a guess. A field that turned "the login one" into issue 1 would close
   * the reader's issue as a duplicate of something they never named.
   */
  test("says nothing where nothing in it is an issue", () => {
    expect(Option.isNone(issueSaid("the login one", here))).toBe(true)
    expect(Option.isNone(issueSaid("", here))).toBe(true)
    expect(Option.isNone(issueSaid("#0", here))).toBe(true)
    expect(Option.isNone(issueSaid("https://github.com/oven-sh/bun/pull/1234", here))).toBe(true)
  })
})
