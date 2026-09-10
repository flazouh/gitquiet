import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { interfaceContainer, takeOverSlot } from "./mount"

let stop = () => {}
afterEach(() => {
  mock.restore()
  stop()
})

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// Count browser-boundary traversals rather than asserting a machine's speed.
test("drawing inside a mounted screen does not traverse GitHub's document", async () => {
  const page = document.implementation.createHTMLDocument("large PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section>native diff</section></div></main>'
  const root = interfaceContainer(page)
  const takeover = takeOverSlot(page, root)
  expect(takeover).not.toBeNull()
  stop = () => { takeover?.stepAside() }
  await turn()
  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")
  for (let i = 0; i < 4; i++) {
    root.textContent = `file ${i}`
    await turn()
  }
  expect(root.isConnected).toBe(true)
  expect(root.textContent).toBe("file 3")
  expect(root.hasAttribute("hidden")).toBe(false)
  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})
