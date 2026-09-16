import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { interfaceContainer, takeOverSlot } from "./mount"

/**
 * What the takeover costs a page it is standing on.
 *
 * This used to be eight tests about hiding: their siblings swept element by
 * element on every mutation, a late region of theirs caught and hidden, a
 * wrapper of theirs made visible again when our screen turned up inside it.
 * None of that happens any more — their page is hidden by one CSS rule that
 * names nothing, and the interface stands in a shadow root of its own.
 *
 * The property those tests were protecting outlived the machinery, and is now
 * stronger: the observer that keeps our container standing must never traverse
 * GitHub's document, however busy their page is. Counted at the browser boundary
 * rather than timed, because a clock on a test runner measures the runner.
 */
let stop = () => {}
afterEach(() => {
  mock.restore()
  stop()
})

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Their page, as busy as the ones this is about. */
const theirPage = (): Document => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML =
    '<main><div class="PageLayoutContent"><section>native diff</section></div></main>'
  return page
}

test("their page churning does not traverse the document", async () => {
  const page = theirPage()
  const takeover = takeOverSlot(page)!
  stop = () => takeover.stepAside()
  await turn()

  // Held before the spies go on, so the test's own reach for it is not counted
  // as the takeover's.
  const theirs = page.querySelector("main")
  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")

  // Everything their React does to a page for the life of it: nodes in, nodes
  // out, a region replaced wholesale.
  const added = [page.createElement("span"), page.createElement("div")]
  for (const node of added) page.body.append(node)
  await turn()
  for (const node of added) node.remove()
  await turn()
  theirs?.replaceChildren(page.createElement("section"))
  await turn()

  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})

test("and leaves our screen standing through all of it", async () => {
  const page = theirPage()
  const takeover = takeOverSlot(page, interfaceContainer(page))!
  stop = () => takeover.stepAside()
  await turn()

  page.body.append(page.createElement("div"))
  page.querySelector("main")?.replaceChildren(page.createElement("section"))
  await turn()

  expect(takeover.container.isConnected).toBe(true)
  expect(takeover.container.hasAttribute("hidden")).toBe(false)
})

test("drawing inside our own screen does not traverse their document either", async () => {
  const page = theirPage()
  const takeover = takeOverSlot(page, interfaceContainer(page))!
  stop = () => takeover.stepAside()
  await turn()

  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")

  // A screen redrawing: a thousand nodes in and out of our own container.
  for (let at = 0; at < 200; at++) {
    const row = page.createElement("div")
    row.textContent = `row ${at}`
    takeover.container.append(row)
  }
  await turn()
  takeover.container.replaceChildren()
  await turn()

  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})
