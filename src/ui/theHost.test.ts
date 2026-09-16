import { afterEach, describe, expect, test } from "bun:test"
import {
  HOST_ID,
  keepTheirStylesOff,
  letTheirStylesBack,
  oursInForce,
  theHost,
  theirStyles
} from "./theHost"

/**
 * The one invariant that keeps a page readable: their stylesheets are off only
 * while ours is on.
 *
 * Both halves of this shipped broken in v0.17.0. `markPage` turned theirs off
 * synchronously at `document_start`; ours is fetched and adopted after, and the
 * report-and-carry-on path on a failed fetch adopted nothing at all. A reader
 * opening a repository's pull requests got a page with no stylesheets of any
 * kind — their page undressed under ours, every heading in Times New Roman,
 * every button the browser's own. The saving is worth having and it is not worth
 * that, so it is taken only once ours is demonstrably in force and given back the
 * moment it is not.
 */
const theirSheet = (page: Document, href: string): void => {
  const link = page.createElement("style")
  link.textContent = "body { color: red }"
  link.setAttribute("data-href", href)
  page.head.append(link)
}

const howMany = (page: Document): { on: number; off: number } => {
  let on = 0
  let off = 0
  for (const sheet of page.styleSheets) {
    if ((sheet.href ?? "").startsWith("chrome-extension://")) continue
    if (sheet.disabled) off += 1
    else on += 1
  }
  return { on, off }
}

const freshPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")
  theirSheet(page, "https://github.githubassets.com/one.css")
  theirSheet(page, "https://github.githubassets.com/two.css")
  return page
}

afterEach(() => {
  for (const host of document.querySelectorAll(`#${HOST_ID}`)) host.remove()
  letTheirStylesBack(document)
})

describe("their stylesheets are off only while ours is on", () => {
  test("says ours is not in force before a sheet has been adopted", () => {
    const page = freshPage()
    theHost(page)

    expect(oursInForce(page)).toBe(false)
  })

  test("refuses to turn theirs off while ours is still coming", () => {
    /*
     * The exact shape of the fault. `markPage` asks for this at
     * `document_start`, when the interface has a host and no stylesheet yet. If
     * the ask were honoured the page would be left with neither sheet.
     */
    const page = freshPage()
    theHost(page)
    expect(howMany(page).on).toBe(2)

    keepTheirStylesOff(page)

    expect(howMany(page)).toEqual({ on: 2, off: 0 })
  })

  test("and puts them back if ours stops being in force", () => {
    // A host replaced, a sheet that never arrived: the answer has to be able to
    // change back, or the reader is left looking at nothing.
    const page = freshPage()
    theHost(page)
    theirStyles(page, false)
    expect(howMany(page).off).toBe(2)

    keepTheirStylesOff(page)

    expect(howMany(page)).toEqual({ on: 2, off: 0 })
  })

  test("turns theirs off once ours really is adopted", () => {
    const page = freshPage()
    const { shadow } = theHost(page)
    const ours = new CSSStyleSheet()
    ours.replaceSync(":host { color: blue }")
    shadow.adoptedStyleSheets = [ours]

    // `oursInForce` asks about the sheet this module built, so a sheet a test
    // adopts by hand is not it — which is the honest answer and the safe one.
    expect(oursInForce(page)).toBe(false)
    keepTheirStylesOff(page)
    expect(howMany(page).off).toBe(0)
  })

  test("hands every one of them back when the page is given up", () => {
    const page = freshPage()
    theirStyles(page, false)
    expect(howMany(page).off).toBe(2)

    letTheirStylesBack(page)

    expect(howMany(page)).toEqual({ on: 2, off: 0 })
  })

  /*
   * Not covered here: that a sheet of ours is spared.
   *
   * `theirStyles` tells ours from theirs by the sheet's `href` being the
   * extension's own origin, or by its owner carrying the outside mark. happy-dom
   * reports neither — `ownerNode` is not an `Element` and `href` is undefined —
   * so a test written against it would pass by accident or fail by accident, and
   * would say nothing about a browser either way. The live probe in
   * `scripts/` asserts the real thing: their sheets off and ours still applying,
   * on a real page, which is where the question has an answer.
   */
})
