import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { gate, handBack, markPage, PAGE, reveal } from "./mount"
import { PLACES } from "./place"
import {
  dressShadow,
  HOST_ID,
  keepTheirStylesOff,
  letTheirStylesBack,
  oursInForce,
  theHost,
  theirStyles,
  theSheet
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

    // `oursInForce` asks about a sheet this extension built, so a sheet a test
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

describe("their stylesheets are off only while the page is ours", () => {
  /*
   * Found on github.com/login, after the page stopped being blank: it came back
   * in Times New Roman. The sign-on screen is started by a root class GitHub
   * puts on its login box too, finds no wall and hands the page back. Then the
   * shell finished building our stylesheet and turned theirs off again, because
   * the one thing `keepTheirStylesOff` asked was whether ours was in force, and
   * it was. Nobody asked whether their page was being shown.
   *
   * And this module is bundled into four scripts, each with its own watcher, so a
   * screen letting their sheets back disconnected its own watcher and not the
   * shell's — which went on turning them off on every change to the page.
   *
   * The marks are on the document, which every copy shares. So that is what each
   * of them asks.
   */
  const inForce = async (page: Document): Promise<void> => {
    const real = globalThis.fetch
    globalThis.fetch = (async () => new Response(":root { color: blue }")) as unknown as typeof fetch
    const built = await Effect.runPromise(
      theSheet("chrome-extension://gitquiet/styles.css").pipe(
        Effect.ensuring(
          Effect.sync(() => {
            globalThis.fetch = real
          })
        )
      )
    )
    dressShadow(theHost(page).shadow, built)
    expect(oursInForce(page)).toBe(true)
  }

  test("keeps theirs on where the page is not one of ours", async () => {
    const page = freshPage()
    await inForce(page)

    keepTheirStylesOff(page)

    expect(howMany(page)).toEqual({ on: 2, off: 0 })
  })

  test("still turns theirs off where the page is ours, which is the saving", async () => {
    const page = freshPage()
    await inForce(page)
    page.documentElement.setAttribute(PAGE, "conversation")

    keepTheirStylesOff(page)

    expect(howMany(page).off).toBe(2)
  })

  test("gives them back the moment the page is handed back, whichever copy does it", async () => {
    const page = freshPage()
    await inForce(page)
    page.documentElement.setAttribute(PAGE, "sign-on")
    keepTheirStylesOff(page)
    expect(howMany(page).off).toBe(2)

    // Another copy of this module hands the page back, which is one attribute on
    // the document they share. Nothing else changes: no child is added, so it is
    // the watch on the marks that has to notice, and not the watch on the page.
    handBack(page)
    await new Promise((go) => setTimeout(go, 0))

    expect(howMany(page)).toEqual({ on: 2, off: 0 })
  })

  test("turns them off again when a page shown is taken back, though it was shown when named", async () => {
    /*
     * A reader on GitHub's Code tab, handed back and shown, presses into a pull
     * request. The press names the page before it gates it, so at the naming their
     * page was on the screen and there was nothing to turn off. Nothing names it
     * again afterwards, so the gate has to be heard or their sheets stay on under
     * ours for the whole screen — every change to it paying their `:has()` rules.
     */
    const page = freshPage()
    await inForce(page)
    reveal(page)
    markPage(page, PLACES[0]!)
    expect(howMany(page).off).toBe(0)

    gate(page)
    await new Promise((go) => setTimeout(go, 0))

    expect(howMany(page).off).toBe(2)
  })

  test("is answered the same by every copy of this module, whichever built the sheet", async () => {
    /*
     * This module is bundled into four scripts. The shell builds our sheet and a
     * screen's copy never does, so a copy asking after its own sheet heard "not in
     * force" for ever, and its watch turned their sheets back on after every change
     * the shell's watch turned them off for. Seen live: a repository's front page
     * taken, with all twenty-seven of their sheets on under ours.
     */
    // @ts-expect-error: a query string is a second instance of the module, as a second bundle is.
    const another = (await import("./theHost?another-copy")) as typeof import("./theHost")
    const page = freshPage()
    await inForce(page)
    page.documentElement.setAttribute(PAGE, "conversation")

    expect(another.oursInForce(page)).toBe(true)
    another.keepTheirStylesOff(page)
    expect(howMany(page).off).toBe(2)
    another.letTheirStylesBack(page)
  })
})
