import { describe, expect, test } from "bun:test"
import { BAR_ID, keepTheBarSlot, takeTheBarDown, theBarSlot, theBarStands, whenAnotherBarStands } from "./barSlot"

const aPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <div class="logged-in">
      <header class="GlobalNav" aria-label="Global navigation menu"></header>
      <main></main>
    </div>
  `
  return page
}

describe("where our bar stands", () => {
  test("above everything of theirs", () => {
    const page = aPage()

    expect(theBarSlot(page)).toBe(page.body.firstElementChild as HTMLElement)
  })

  test("once, however many screens ask for it", () => {
    const page = aPage()

    expect(theBarSlot(page)).toBe(theBarSlot(page))
    expect(page.querySelectorAll(`#${BAR_ID}`).length).toBe(1)
  })

  test("comes back when their page throws it away", async () => {
    const page = aPage()
    const slot = theBarSlot(page)
    const stop = keepTheBarSlot(page, slot)

    slot.remove()
    // The observer runs as a microtask, so the next tick is when the answer is in.
    await Promise.resolve()

    expect(slot.isConnected).toBe(true)
    expect(page.body.firstElementChild).toBe(slot)
    stop()
  })

  /*
   * A Turbo visit replaces `body` itself, not its children. Measured on a press from a
   * repository's commits to one commit: the keeper still held the old body, put the slot
   * back into it, heard its own insert, and did it again for ever. The tab froze.
   */
  test("follows a body Turbo swapped in, and does not spin on the old one", async () => {
    const page = aPage()
    const slot = theBarSlot(page)
    const stop = keepTheBarSlot(page, slot)
    const old = page.body
    // Fails the test instead of hanging it, if the keeper spins on the old body.
    let inserts = 0
    const insert = old.insertBefore.bind(old)
    old.insertBefore = <T extends Node>(node: T, child: Node | null): T => {
      inserts += 1
      if (inserts > 20) throw new Error("the keeper is spinning on a detached body")
      return insert(node, child)
    }

    const fresh = page.createElement("body")
    fresh.innerHTML = `<div class="logged-in"><main></main></div>`
    old.replaceWith(fresh)
    // Whatever tears the leaving page down still touches the old body, and one
    // mutation there is all the loop needed to start.
    old.append(page.createElement("span"))
    for (let tick = 0; tick < 5; tick++) await Promise.resolve()

    expect(inserts).toBe(0)
    expect(page.body).toBe(fresh)
    expect(fresh.firstElementChild).toBe(slot)

    // And it keeps watching the new body, not the old one.
    slot.remove()
    await Promise.resolve()
    expect(fresh.firstElementChild).toBe(slot)
    stop()
  })

  test("is not put back once the page has been handed to GitHub", async () => {
    // The leaving bar's keeper outlives the hand-over by a render, and it put the slot
    // straight back: an empty band of ours over their page after "Leave GitQuiet".
    const page = aPage()
    const slot = theBarSlot(page)
    const stop = keepTheBarSlot(page, slot)

    takeTheBarDown(page)
    slot.remove()
    await Promise.resolve()

    expect(slot.isConnected).toBe(false)
    stop()
  })

  test("stops being watched when the screen goes", async () => {
    const page = aPage()
    const slot = theBarSlot(page)
    keepTheBarSlot(page, slot)()

    slot.remove()
    await Promise.resolve()

    expect(slot.isConnected).toBe(false)
  })
})

/*
 * The handover, measured on the page it kept going wrong on.
 *
 * Pressing a run from the Actions list: the leaving screen's bar came off the moment the
 * arriving screen took the page, and the arriving screen's own bar needed eighty more
 * milliseconds to render. For those eighty the slot was empty, so the bar collapsed and
 * the whole page jumped up and back down again under the reader's pointer.
 */
describe("holding the bar until the next one is up", () => {
  const aBar = (page: Document): HTMLElement => {
    const bar = page.createElement("header")
    theBarSlot(page).append(bar)
    return bar
  }

  test("waits for the arriving screen's bar to say it is up", async () => {
    const page = aPage()
    aBar(page)
    let down = false

    whenAnotherBarStands(page, () => {
      down = true
    })
    await Promise.resolve()
    expect(down).toBe(false)

    theBarStands(page)

    expect(down).toBe(true)
  })

  test("comes down on its own where no other bar arrives", async () => {
    // The reader went to a page of GitHub's. Nothing is coming, and a bar left up for a
    // screen nobody is on is worse than the gap this exists to close.
    const page = aPage()
    aBar(page)
    let down = false

    whenAnotherBarStands(
      page,
      () => {
        down = true
      },
      10
    )
    await new Promise((ready) => setTimeout(ready, 30))

    expect(down).toBe(true)
  })

  test("says so at once where there is no bar to hold", async () => {
    // A screen that never drew one, and the tests that render a bar with no slot at all.
    const page = aPage()
    let down = false

    whenAnotherBarStands(page, () => {
      down = true
    })
    await Promise.resolve()

    expect(down).toBe(true)
  })
})
