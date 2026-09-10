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

test("updates below a hidden native diff do not traverse a settled page", async () => {
  const page = document.implementation.createHTMLDocument("large PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section>native diff</section></div></main>'
  const native = page.querySelector("section")!
  const takeover = takeOverSlot(page)
  expect(takeover).not.toBeNull()
  stop = () => { takeover?.stepAside() }
  await turn()
  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")
  for (let i = 0; i < 4; i++) {
    native.replaceChildren(page.createElement("span"))
    await turn()
  }
  expect(native.hasAttribute("hidden")).toBe(true)
  expect(takeover?.container.isConnected).toBe(true)
  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})

test("a mixed batch still hides a new native sibling and keeps the new screen text", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<div class="PageLayoutContent"><section>native</section></div>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  const sibling = page.createElement("aside")
  takeover.container.textContent = "new file"
  takeover.container.parentElement!.append(sibling)
  await turn()
  expect(sibling.hasAttribute("hidden")).toBe(true)
  expect(takeover.container.textContent).toBe("new file")
  expect(takeover.container.hasAttribute("hidden")).toBe(false)
})

test("a real region arriving inside a hidden fallback still receives the screen", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<div id="repo-content-pjax-container"><react-app app-name="pull-requests"></react-app></div>'
  const native = page.querySelector("react-app")!
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  await turn()
  expect(native.hasAttribute("hidden")).toBe(true)
  const region = page.createElement("div")
  region.className = "PageLayoutContent"
  native.append(region)
  await turn()
  expect(takeover.container.parentElement).toBe(region)
  expect(native.hasAttribute("hidden")).toBe(false)
})

test("removing a region in the same batch as a screen update still restores the screen", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section>native</section></div></main>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  const old = takeover.container.parentElement!
  takeover.container.textContent = "file stays open"
  const replacement = page.createElement("div")
  replacement.className = "PageLayoutContent"
  old.replaceWith(replacement)
  await turn()
  expect(takeover.container.parentElement).toBe(replacement)
  expect(takeover.container.textContent).toBe("file stays open")
})
