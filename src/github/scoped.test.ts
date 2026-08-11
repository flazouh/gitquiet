import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { scopedRepositoryIn } from "./scoped"

const STACK_PROBE = { owner: "flazouh", repo: "stack-probe" }

/**
 * The payload as GitHub really writes it, trimmed.
 *
 * Read off `github.com/flazouh/stack-probe/issues/new` on 5 August 2026: the key
 * sits beside the app's own configuration, several levels in, with the owner and
 * the name next to the id.
 */
const theirs = JSON.stringify({
  payload: {
    catalog_service: "github/issues",
    scoped_repository: {
      id: "R_kgDOTndREA",
      owner: "flazouh",
      name: "stack-probe",
      is_archived: false
    }
  }
})

describe("the repository a page is scoped to", () => {
  test("reads the node id their own writes are addressed by", () => {
    expect(scopedRepositoryIn([theirs], STACK_PROBE)).toEqual(Option.some("R_kgDOTndREA"))
  })

  test("finds it among the payloads that are the header and the sidebar", () => {
    const others = [
      JSON.stringify({ payload: { title: "stack-probe" } }),
      JSON.stringify({ payload: { preloadedQueries: [] } })
    ]

    expect(scopedRepositoryIn([...others, theirs], STACK_PROBE)).toEqual(
      Option.some("R_kgDOTndREA")
    )
  })

  test("does not mind how the reader spelt the address", () => {
    // `/Facebook/React` and `/facebook/react` are one repository to GitHub.
    expect(scopedRepositoryIn([theirs], { owner: "Flazouh", repo: "Stack-Probe" })).toEqual(
      Option.some("R_kgDOTndREA")
    )
  })

  test("refuses an id belonging to another repository", () => {
    // Their app navigates without loading, so a document can outlive the
    // repository it was served for. A write aimed by this id would raise an issue
    // somewhere the reader never asked about, and nothing on the screen would say so.
    expect(scopedRepositoryIn([theirs], { owner: "facebook", repo: "react" })).toEqual(
      Option.none()
    )
  })

  test("refuses a payload that names an id and not whose it is", () => {
    const unsaid = JSON.stringify({ payload: { scoped_repository: { id: "R_kgDOTndREA" } } })

    expect(scopedRepositoryIn([unsaid], STACK_PROBE)).toEqual(Option.none())
  })

  test("is nothing where no payload carries the key", () => {
    expect(scopedRepositoryIn([JSON.stringify({ payload: {} })], STACK_PROBE)).toEqual(
      Option.none()
    )
  })

  test("goes on past a payload that will not parse", () => {
    // Their own escaping, and the reason `embeddedPayload` guards the same thing:
    // a README carrying a closing tag as text leaves a slice that is not JSON.
    expect(scopedRepositoryIn(["{scoped_repository: not json", theirs], STACK_PROBE)).toEqual(
      Option.some("R_kgDOTndREA")
    )
  })

  test("is nothing where a page carried no payloads at all", () => {
    expect(scopedRepositoryIn([], STACK_PROBE)).toEqual(Option.none())
  })

  test("gives up rather than walking a payload to the bottom", () => {
    // The cap is the point: their payloads are theirs, and one holding a cycle or
    // one far larger than anything measured has to be a miss rather than a hung
    // tab. Their key sits shallow, so nothing real is lost to it.
    let deep: unknown = { scoped_repository: { id: "R_x", owner: "flazouh", name: "stack-probe" } }
    for (let down = 0; down < 12; down += 1) deep = { down: deep }

    expect(scopedRepositoryIn([JSON.stringify(deep)], STACK_PROBE)).toEqual(Option.none())
  })
})
