import { describe, expect, test } from "bun:test"
import {
  forgetIntent,
  intendTo,
  intendedPath,
  prepareTo,
  whenPreparing
} from "./intent"

const aWindow = () => ({}) as Window

describe("recording which pull request somebody pressed", () => {
  test("says nothing when nobody has pressed anything", () => {
    expect(intendedPath(aWindow())).toBeNull()
  })

  test("remembers where a press was headed", () => {
    const world = aWindow()

    intendTo(world, "/microsoft/vscode/pull/327751")

    expect(intendedPath(world)).toBe("/microsoft/vscode/pull/327751")
  })

  test("a second press replaces the first", () => {
    const world = aWindow()

    intendTo(world, "/microsoft/vscode/pull/1")
    intendTo(world, "/microsoft/vscode/pull/2")

    expect(intendedPath(world)).toBe("/microsoft/vscode/pull/2")
  })

  test("is forgotten once acted on, so a later arrival is not sent to it", () => {
    const world = aWindow()
    intendTo(world, "/microsoft/vscode/pull/327751")

    forgetIntent(world)

    expect(intendedPath(world)).toBeNull()
  })
})

describe("preparing a route before it is pressed", () => {
  test("tells a standing screen which route the pointer earned", () => {
    const world = aWindow()
    const heard: Array<string> = []

    whenPreparing(world, (path) => heard.push(path))
    prepareTo(world, "/microsoft/vscode/pull/327751")

    expect(heard).toEqual(["/microsoft/vscode/pull/327751"])
  })

  test("stops telling a screen after that screen leaves", () => {
    const world = aWindow()
    const heard: Array<string> = []
    const stop = whenPreparing(world, (path) => heard.push(path))

    stop()
    prepareTo(world, "/microsoft/vscode/pull/327751")

    expect(heard).toEqual([])
  })
})
