import { describe, expect, test } from "bun:test"
import {
  offerPreparedTraversal,
  preparedArrival,
  whenPreparedTraversalIsOffered
} from "./preparedNavigation"

describe("a prepared history arrival", () => {
  test("does not open the live screen again when the address commits", () => {
    const arrival = preparedArrival()

    arrival.start("/owner/repo/issues/12")

    expect(arrival.committed("/owner/repo/issues/12")).toBe(true)
    expect(arrival.committed("/owner/repo/issues/12")).toBe(false)
  })

  test("does not hide a different address change", () => {
    const arrival = preparedArrival()

    arrival.start("/owner/repo/issues/12")

    expect(arrival.committed("/owner/repo/issues/13")).toBe(false)
    expect(arrival.committed("/owner/repo/issues/12")).toBe(true)
  })
})

describe("a prepared traversal crossing browser worlds", () => {
  test("offers the exact route through the shared document", async () => {
    const page = document.implementation.createHTMLDocument("GitHub")
    const seen: Array<string> = []
    const stop = whenPreparedTraversalIsOffered(page, (route) => seen.push(route))

    offerPreparedTraversal(page, "/owner/repo/issues/12")
    await Promise.resolve()

    expect(seen).toEqual(["/owner/repo/issues/12"])
    stop()
  })
})
