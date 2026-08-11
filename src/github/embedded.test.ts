import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { embeddedPayload } from "./embedded"

const script = (said: string) =>
  `<script type="application/json" data-target="react-app.embeddedData">${said}</script>`

const found = (html: string, naming: string) => Option.getOrNull(embeddedPayload(html, naming))

describe("the payload GitHub embeds in a page it rendered", () => {
  test("reads it out of the script they mark", () => {
    expect(found(`<html>${script('{"payload":{"codeViewRepoRoute":{"a":1}}}')}</html>`, "codeViewRepoRoute")).toEqual({
      payload: { codeViewRepoRoute: { a: 1 } }
    })
  })

  /*
   * The case that makes the route name a parameter rather than taking the first
   * script found. A repository page carries payloads for its header and its
   * sidebar as well, and decoding the header's data as a file tree fails in a way
   * that reads as a broken repository.
   */
  test("passes over a payload for another part of the page", () => {
    const html = script('{"payload":{"repoHeader":{}}}') + script('{"payload":{"codeViewRepoRoute":{"a":2}}}')
    expect(found(html, "codeViewRepoRoute")).toEqual({ payload: { codeViewRepoRoute: { a: 2 } } })
  })

  test("says nothing where the page carries no such payload", () => {
    expect(found("<html><body>nothing here</body></html>", "codeViewRepoRoute")).toBeNull()
  })

  test("says nothing rather than throwing where their script holds broken JSON", () => {
    expect(found(script('{"codeViewRepoRoute": oops}'), "codeViewRepoRoute")).toBeNull()
  })

  test("keeps looking after a broken one, so a bad payload does not hide a good one", () => {
    const html = script('{"codeViewRepoRoute": oops}') + script('{"codeViewRepoRoute":{"a":3}}')
    expect(found(html, "codeViewRepoRoute")).toEqual({ codeViewRepoRoute: { a: 3 } })
  })

  test("says nothing where their script never closes", () => {
    expect(found(`<html>${'<script type="application/json" data-target="react-app.embeddedData">{'}`, "codeViewRepoRoute")).toBeNull()
  })
})
