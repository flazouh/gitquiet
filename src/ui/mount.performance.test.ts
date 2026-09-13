import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { interfaceContainer, takeOverSlot } from "./mount"

let stop = () => {}
afterEach(() => {
  mock.restore()
  stop()
})

const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

test("opening and closing focus guards keeps the screen visible without traversing the page", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section>native</section></div></main>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  await turn()
  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")
  const guards = [page.createElement("span"), page.createElement("span")]
  for (const guard of guards) {
    guard.setAttribute("data-radix-focus-guard", "")
    page.body.append(guard)
  }
  await turn()
  for (const guard of guards) guard.remove()
  await turn()
  expect(takeover.container.isConnected).toBe(true)
  expect(takeover.container.hasAttribute("hidden")).toBe(false)
  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})

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
  const guard = page.createElement("span")
  guard.setAttribute("data-radix-focus-guard", "")
  page.body.append(guard)
  takeover.container.textContent = "new file"
  takeover.container.parentElement!.append(sibling)
  await turn()
  expect(sibling.hasAttribute("hidden")).toBe(true)
  expect(takeover.container.textContent).toBe("new file")
  expect(takeover.container.hasAttribute("hidden")).toBe(false)
})

test("a focus guard marker does not hide a real region inside a nonempty node", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<div id="repo-content-pjax-container"></div>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  const guard = page.createElement("span")
  guard.setAttribute("data-radix-focus-guard", "")
  const region = page.createElement("div")
  region.className = "PageLayoutContent"
  guard.append(region)
  page.body.append(guard)
  await turn()
  expect(takeover.container.parentElement).toBe(page.body)
  expect(guard.hasAttribute("hidden")).toBe(true)
  expect(takeover.container.hasAttribute("hidden")).toBe(false)
})

test("a late region inside hidden native content stays hidden without a document scan", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<div id="repo-content-pjax-container"><react-app app-name="pull-requests"></react-app></div>'
  const native = page.querySelector("react-app")!
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  await turn()
  expect(native.hasAttribute("hidden")).toBe(true)
  const region = page.createElement("div")
  region.className = "PageLayoutContent"
  const one = spyOn(page, "querySelector")
  const all = spyOn(page, "querySelectorAll")
  native.append(region)
  await turn()
  expect(takeover.container.parentElement).toBe(page.body)
  expect(native.hasAttribute("hidden")).toBe(true)
  expect(one).not.toHaveBeenCalled()
  expect(all).not.toHaveBeenCalled()
})

test("replacing a native region in the same batch as a screen update keeps the screen on body", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"><section>native</section></div></main>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  const old = page.querySelector(".PageLayoutContent")!
  takeover.container.textContent = "file stays open"
  const replacement = page.createElement("div")
  replacement.className = "PageLayoutContent"
  old.replaceWith(replacement)
  await turn()
  expect(takeover.container.parentElement).toBe(page.body)
  expect(replacement.closest("[hidden]")).not.toBeNull()
  expect(takeover.container.textContent).toBe("file stays open")
})


test("a hidden wrapper around our screen is made visible", async () => {
  const page = document.implementation.createHTMLDocument("PR")
  page.body.innerHTML = '<main><div class="PageLayoutContent"></div></main>'
  const takeover = takeOverSlot(page)!
  stop = () => { takeover.stepAside() }
  await turn()
  const wrapper = page.querySelector("main")!
  expect(wrapper.hasAttribute("hidden")).toBe(true)
  wrapper.append(takeover.container)
  await turn()
  expect(takeover.container.isConnected).toBe(true)
  expect(takeover.container.closest("[hidden]")).toBeNull()
})
