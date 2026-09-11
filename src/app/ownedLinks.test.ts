import { afterEach, expect, mock, test } from "bun:test"
import { OWNED_ROUTE } from "./navigationGuard"
import { protectOwnedLinks } from "./ownedLinks"

let stop = () => {}
afterEach(() => { mock.restore(); stop() })
const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const owned = (link: HTMLAnchorElement) => link.getAttribute("href")?.startsWith("/pull/") === true

const pageWithLinks = () => {
  const page = document.implementation.createHTMLDocument("GitHub")
  page.body.innerHTML = '<main><a href="/pull/native">native</a></main><div id="gitquiet-root"><a href="/pull/one">one</a><a href="https://example.com">external</a></div><div id="gitquiet-bar"><a href="/pull/two">two</a></div>'
  return page
}

test("existing and added owned links are protected without taking native links", async () => {
  const page = pageWithLinks()
  stop = protectOwnedLinks(page, owned)
  const root = page.getElementById("gitquiet-root")!
  expect(root.querySelector("a")?.getAttribute(OWNED_ROUTE)).toBe("/pull/one")
  expect(page.getElementById("gitquiet-bar")?.querySelector("a")?.getAttribute(OWNED_ROUTE)).toBe("/pull/two")
  expect(page.querySelector("main a")?.hasAttribute(OWNED_ROUTE)).toBe(false)
  expect(root.querySelector('a[href="https://example.com"]')?.hasAttribute(OWNED_ROUTE)).toBe(false)
  const link = page.createElement("a")
  link.href = "/pull/three"
  root.append(link)
  await turn()
  expect(link.getAttribute(OWNED_ROUTE)).toBe("/pull/three")
})

test("native diff updates neither traverse the document nor reconsider existing owned links", async () => {
  const page = pageWithLinks()
  const owns = mock(owned)
  stop = protectOwnedLinks(page, owns)
  await turn()
  owns.mockClear()
  const native = page.querySelector("main")!
  const originalQuery = page.querySelectorAll.bind(page)
  const queries = mock(originalQuery)
  page.querySelectorAll = queries
  for (let i = 0; i < 4; i++) {
    native.replaceChildren(page.createElement("span"))
    await turn()
  }
  expect(owns).not.toHaveBeenCalled()
  expect(queries).not.toHaveBeenCalled()
  expect(page.getElementById("gitquiet-root")?.querySelector("a")?.getAttribute(OWNED_ROUTE)).toBe("/pull/one")
})

test("a reused anchor follows its new route and stops intercepting an external destination", async () => {
  const page = pageWithLinks()
  stop = protectOwnedLinks(page, owned)
  const link = page.getElementById("gitquiet-root")!.querySelector("a")!
  link.href = "/pull/changed"
  await turn()
  expect(link.getAttribute(OWNED_ROUTE)).toBe("/pull/changed")
  link.href = "https://example.com"
  await turn()
  expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
  link.href = "/pull/back"
  await turn()
  link.removeAttribute("href")
  await turn()
  expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
})

test("late and replaced roots protect nested additions once", async () => {
  const page = document.implementation.createHTMLDocument("GitHub")
  const owns = mock(owned)
  stop = protectOwnedLinks(page, owns)
  const root = page.createElement("div")
  root.id = "gitquiet-root"
  page.body.append(root)
  const group = page.createElement("section")
  root.append(group)
  const link = page.createElement("a")
  link.href = "/pull/late"
  group.append(link)
  // Reordering in the same batch must not multiply the work.
  root.append(link)
  group.append(link)
  await turn()
  expect(link.getAttribute(OWNED_ROUTE)).toBe("/pull/late")
  expect(owns).toHaveBeenCalledTimes(1)
  const replacement = page.createElement("div")
  replacement.id = "gitquiet-root"
  replacement.innerHTML = '<a href="/pull/replacement">replacement</a>'
  root.replaceWith(replacement)
  await turn()
  expect(replacement.querySelector("a")?.getAttribute(OWNED_ROUTE)).toBe("/pull/replacement")
})

test("a removed addition and changes after teardown stay untouched", async () => {
  const page = pageWithLinks()
  const owns = mock(owned)
  stop = protectOwnedLinks(page, owns)
  await turn()
  owns.mockClear()
  const root = page.getElementById("gitquiet-root")!
  const link = page.createElement("a")
  link.href = "/pull/removed"
  root.append(link)
  link.remove()
  await turn()
  expect(owns).not.toHaveBeenCalled()
  expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
  stop()
  root.append(link)
  await turn()
  expect(owns).not.toHaveBeenCalled()
  expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
})

test("a link moved into native content before delivery is not intercepted", async () => {
  const page = pageWithLinks()
  stop = protectOwnedLinks(page, owned)
  await turn()
  const link = page.createElement("a")
  link.href = "/pull/native-move"
  page.getElementById("gitquiet-root")!.append(link)
  page.querySelector("main")!.append(link)
  await turn()
  expect(link.hasAttribute(OWNED_ROUTE)).toBe(false)
})
